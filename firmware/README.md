# Wristband firmware

Hardware decisions, milestone sequence, and the "why" behind all of this live in
the repo root `CLAUDE.md` — that's the source of truth, this file is just the
firmware-folder map and setup steps. Read `CLAUDE.md` first if you haven't.

## Status

No hardware has arrived yet. Everything in here is software-only prep: get the
toolchain working now so there's nothing left to figure out except the actual
electronics once the board shows up. Nothing past milestone 1 is written yet —
BLE (milestone 2) and beyond come only after milestone 1 is proven on the real
board, per the "smallest provable step, don't skip ahead" rule in `CLAUDE.md`.

## One-time setup on the Windows laptop (do this now, no board needed)

1. Install **Arduino IDE 2.x**: <https://www.arduino.cc/en/software> (Windows
   installer or the Microsoft Store version, either is fine).
2. Open it, go to **File → Preferences**, find **"Additional boards manager
   URLs"**, and paste in:
   ```
   https://files.seeedstudio.com/arduino/package_seeeduino_boards_index.json
   ```
3. **Tools → Board → Boards Manager…**, search `Seeed nRF52`, install the
   **"Seeed nRF52 Boards"** package (this is what teaches Arduino IDE about
   the XIAO nRF52840 Sense specifically).
4. That's everything that can be done without the board. The IMU library
   (step 3 inside `01-imu-serial/01-imu-serial.ino`'s header comment) needs
   the board selected first, so do that once it arrives.

## When the board arrives

1. **Tools → Board →** find **"Seeed XIAO nRF52840 Sense"** in the list and
   select it.
2. Plug in over USB-C. Windows 10/11 should recognize the nRF52's bootloader
   without extra drivers. If **Tools → Port** shows nothing, double-tap the
   board's reset button — it should reappear as a USB drive named
   `XIAO-SENSE` (bootloader mode), then a COM port should show up after a
   few seconds.
3. Open `00-blink/00-blink.ino`, hit **Upload**. Confirm the LED blinks. This
   proves the whole toolchain end to end before anything sensor-related.
4. Only then move to `01-imu-serial/01-imu-serial.ino` — install the "Seeed
   Arduino LSM6DS3" library first (instructions in that file's header
   comment), upload, open the Serial Monitor at 115200 baud, and watch the
   accelerometer respond to tilting the board.
5. Milestone 1 (per `CLAUDE.md`) also wants this taped to a wrist to watch
   for step-like spikes in the Serial Monitor output — no code changes
   needed for that, just watching the numbers while walking.

Milestone 2 (BLE → app, desktop Chrome, Web Bluetooth) starts only after all
of the above is actually working on the physical board.
