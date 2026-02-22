import threading
import time
import webbrowser

from app import run_server


def main():
    thread = threading.Thread(target=run_server, kwargs={"port": 3000}, daemon=True)
    thread.start()
    time.sleep(1)
    webbrowser.open("http://127.0.0.1:3000")
    print("Pixel Monster Quest Desktop is running. Close this window to exit.")
    while True:
        time.sleep(1)


if __name__ == "__main__":
    main()
