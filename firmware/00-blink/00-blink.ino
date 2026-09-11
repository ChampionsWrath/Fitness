/*
  00-blink: prove the toolchain works before anything else touches the IMU.

  What this checks: Arduino IDE can compile code, the Seeed nRF52 board
  package is installed correctly, and USB-C upload to the XIAO nRF52840
  Sense actually works end to end. Nothing about the IMU yet -- that's
  the next sketch (01-imu-serial). Smallest provable step first.

  Expect: the onboard LED blinks on, then off, once per second.

  NOTE ON POLARITY: some XIAO boards wire the built-in LED "active low"
  (LOW turns it ON, HIGH turns it OFF) instead of the usual Arduino
  convention. This sketch is written the normal way (HIGH = on). If you
  upload it and the LED does the *opposite* of what's described above --
  on when it should be off -- that's why. Just swap HIGH and LOW below.
  Not a bug in the board or a wiring mistake, just a quirk of this chip.
*/

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
