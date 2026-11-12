# Builds the whole film: render every section, join them, make effects + score + voices, mix to -14 LUFS, mux.
#   bash render/build-film.sh            everything
#   PARTS="act2 act3" bash render/build-film.sh   re-render only some sections, then rebuild the rest
#   SKIP_RENDER=1 bash render/build-film.sh       audio + assembly only
set -e
V=$(cd "$(dirname "$0")/.." && pwd)
NAME=${NAME:-wanjian2-full-v3}
ALL="prologue act1 act2 act3 act4 act5 act6 epilogue"
cd "$V/render"
if [ -z "$SKIP_RENDER" ]; then
  for a in ${PARTS:-$ALL}; do echo "== $a $(date +%T)"; node render.mjs "film/film.html?shot=$a" ../out/scene-$a.mp4 2>&1 | grep -v "^frame" | tail -1; done
fi

# picture: hard cuts (the shots carry their own whip-pan / match-cut transitions), fade in at the start and out at the end
cd "$V/out"
args=""; fc=""; i=0
for p in $ALL; do
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 scene-$p.mp4)
  args="$args -i scene-$p.mp4"
  fx="null"; [ $p = prologue ] && fx="fade=t=in:st=0:d=1.5"; [ $p = epilogue ] && fx="fade=t=out:st=$(awk "BEGIN{print $d-2.1}"):d=2.1"
  fc="$fc[$i:v]$fx,setpts=PTS-STARTPTS[v$i];"; i=$((i+1))
done
cat=""; for j in $(seq 0 $((i-1))); do cat="$cat[v$j]"; done
ffmpeg -y -loglevel error $args -filter_complex "${fc}${cat}concat=n=$i:v=1:a=0[out]" -map "[out]" -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -movflags +faststart $NAME.mp4

# sound: effects (from the event lists the renderer wrote), the continuous score, voices; then loudness and a true-peak limit
cd "$V/audio" && node score.mjs && node music.mjs && node mix.mjs
cd "$V/out/audio"
J=$(ffmpeg -hide_banner -i mix.wav -af loudnorm=I=-14:TP=-1:LRA=11:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
g() { echo "$J" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
ffmpeg -y -loglevel error -i mix.wav -af "loudnorm=I=-14:TP=-1:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=192000,alimiter=limit=0.7:attack=2:release=80:level=disabled,aresample=48000" mix-final.wav
cd "$V/out"
ffmpeg -y -loglevel error -i $NAME.mp4 -i audio/mix-final.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 320k -shortest -movflags +faststart $NAME-sound.mp4
ffmpeg -hide_banner -i $NAME-sound.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E " I:| Peak:" | tail -2
echo "wrote $V/out/$NAME-sound.mp4"
