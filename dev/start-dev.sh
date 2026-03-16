#!/usr/bin/env bash

# --- Configuration ---
IMAGE_NAME="gnome49-local"
CONTAINER_NAME="x11docker-gnome-dev"
EXTENSION_UUID="awesome-tiles@velitasali.com"
SCHEMA_ID="org.gnome.shell.extensions.awesome-tiles"

# Resolved Paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST_PROJECT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEV_DIR="$HOST_PROJECT/$EXTENSION_UUID.shell-extension"

# Ensure we are in the project root for relative paths to work
cd "$HOST_PROJECT" || { echo "❌ Failed to change directory to project root: $HOST_PROJECT"; exit 1; }

# --- Cleanup Logic ---

function cleanup {
    echo -e "\n👋 Dev session ended. Cleaning up..."
    # 1. Kill the watcher and its children (inotifywait)
    if [ -n "$WATCHER_PID" ]; then
        pkill -P "$WATCHER_PID" 2>/dev/null || true
        kill "$WATCHER_PID" 2>/dev/null || true
    fi
    # 2. Stop the container
    if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
        echo "🛑 Stopping container..."
        docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

# --- Functions ---

function build_extension_folder {
    echo "🛠️  [BUILD] Syncing source and compiling..."
    mkdir -p "$DEV_DIR/schemas"
    rsync -av --delete src/ "$DEV_DIR/"
    
    if [ -f "src/schemas/$SCHEMA_ID.gschema.xml" ]; then
        glib-compile-schemas "$DEV_DIR/schemas/"
    fi

    # Compile translations
    if [ -d "po" ]; then
        echo "🌐 [BUILD] Compiling translations..."
        for po_file in po/*.po; do
            if [ -f "$po_file" ]; then
                lang=$(basename "$po_file" .po)
                locale_dir="$DEV_DIR/locale/$lang/LC_MESSAGES"
                mkdir -p "$locale_dir"
                msgfmt "$po_file" -o "$locale_dir/$EXTENSION_UUID.mo"
                echo "   ✅ $lang compiled"
            fi
        done
    fi
}

function start_watcher {
    pkill -f "inotifywait.*src/" || true
    (
        echo "👀 [WATCHER] Monitoring src/ and po/..."
        # Watch both folders
        inotifywait -m -r -e close_write --format '%w%f' src/ po/ | while read -r MODIFIED
        do
            echo "⚡ [CHANGE] Detected in $MODIFIED."
            build_extension_folder
            
            if [ "$(docker ps -q -f name=$CONTAINER_NAME)" ]; then
                echo "♻️  [RESTART] Killing container to trigger fresh boot..."
                docker stop "$CONTAINER_NAME" > /dev/null 2>&1
            fi
        done
    ) &
    WATCHER_PID=$!
}

# --- Main Execution ---

# 1. Argument Parsing
REBUILD=false
X11_LANG_VAL=""

for arg in "$@"; do
    case $arg in
        rebuild)
            REBUILD=true
            ;;
        --lang=*)
            X11_LANG_VAL="${arg#*=}"
            ;;
        *)
            # If it looks like a locale (e.g., ru_RU.UTF-8 or de_DE), treat it as lang
            if [[ $arg =~ ^[a-z]{2}(_[A-Z]{2})?(\.[Uu][Tt][Ff]-?8)?$ ]]; then
                X11_LANG_VAL="$arg"
            fi
            ;;
    esac
done

# 2. Image Check
[[ "$REBUILD" == "true" ]] && docker rmi -f $IMAGE_NAME 2>/dev/null
# Point to dev/ directory where Dockerfile is now located
[[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]] && docker build -t $IMAGE_NAME dev/

# 2. Initial Build
build_extension_folder

# 3. Start Watcher
start_watcher

# 4. The Run Loop
echo "🚀 Entering Dev Loop. Close the GNOME window to exit script."
while true; do
    echo "🖥️  Starting x11docker..."
    
    # Build x11docker options array
    X11_OPTS=(
      --name "$CONTAINER_NAME"
      --desktop
      --gpu
      --init=systemd
      --ipc=host
      --network=host
      --dbus
      --cap-default
      --home
      --size 1920x1080
    )
    [ -n "$X11_LANG_VAL" ] && X11_OPTS+=(--lang="$X11_LANG_VAL")

    # Build docker run options array
    DOCKER_OPTS=(
      --cap-add ALL
      --privileged
      --security-opt seccomp=unconfined
      --security-opt apparmor=unconfined
      -v "$DEV_DIR:/home/$(whoami)/.local/share/gnome-shell/extensions/$EXTENSION_UUID"
    )

    x11docker "${X11_OPTS[@]}" -- "${DOCKER_OPTS[@]}" -- "$IMAGE_NAME" gnome-shell

    # If x11docker exited naturally (you closed the window), stop the loop
    # We check if the watcher is still running; if we manually killed the container, 
    # we continue. If you Ctrl+C, we exit.
    read -t 1 -n 1 && break || echo "🔄 Restarting session..."
done

cleanup
