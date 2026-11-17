# build + preview one character: bash chars/make.sh swordsman
set -e
cd "$(dirname "$0")/.."
B="/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"
"$B" -b --python chars/build_char.py -- chars/$1.json assets/characters/$1.glb 2>&1 | grep -E "Traceback|Error|error:|wrote" || true
mkdir -p out/test
"$B" -b --factory-startup --python chars/preview.py -- assets/characters/$1.glb "$(pwd -W)/out/test/$1" 2>&1 | grep -E "Traceback|Error" || true
cd out/test && ffmpeg -y -loglevel error -i $1-front.png -i $1-side.png -i $1-back.png -i $1-face.png -filter_complex "[0][1][2][3]hstack=4,scale=1800:-1" pv-$1.png
