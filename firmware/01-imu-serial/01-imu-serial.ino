/*
  01-imu-serial: read the onboard 6-axis IMU (LSM6DS3TR-C) and print
  accelerometer + gyroscope values to the Serial Monitor.

  Only the "Sense" variant of the XIAO nRF52840 has this chip onboard --
  double check "Sense" is printed on the physical board once it's in
  hand (already checked when ordering, per CLAUDE.md, but the plain
  XIAO nRF52840 looks near-identical and has no IMU at all).

  ONE-TIME SETUP in Arduino IDE, after 00-blink has already worked:
    1. Sketch -> Include Library -> Manage Libraries...
    2. Search "Seeed Arduino LSM6DS3", install it (by Seeed Studio).
    3. File -> Examples -> Seeed Arduino LSM6DS3 -> open its bundled
       example. If anything below doesn't compile, or behaves
       differently than described, trust that bundled example over
       this file -- it ships with the exact library version you
       installed; these comments were written from memory beforehand
       and could be slightly off.

  WHAT'S AN I2C DEVICE ADDRESS? The IMU talks to the main chip over I2C,
  a two-wire bus where several chips can share the same two pins, each
  only answering to its own address (like a phone extension number).
  The library needs the IMU's address to talk to the right chip -- 0x6A
  is the documented default for this board.

  Expect: open Tools -> Serial Monitor, set the baud rate to 115200 (the
  dropdown in the bottom-right of that window), hold the board still --
  the accelerometer numbers should settle near 0 on two axes and near
  1.0 on whichever axis points straight down (that's gravity, measured
  in g). Tilt or shake the board and watch the numbers move live.
*/

#include "LSM6DS3.h"
#include "Wire.h"

LSM6DS3 myIMU(I2C_MODE, 0x6A);

void setup() {
  Serial.begin(115200);
  while (!Serial) {
    delay(10); // wait for the Serial Monitor to connect
  }

  if (myIMU.begin() != 0) {
    Serial.println("IMU init failed -- check the board is the Sense variant, then try again.");
  } else {
    Serial.println("IMU ready.");
  }
}

void loop() {
  Serial.print("accel g  x=");
  Serial.print(myIMU.readFloatAccelX(), 3);
  Serial.print(" y=");
  Serial.print(myIMU.readFloatAccelY(), 3);
  Serial.print(" z=");
  Serial.print(myIMU.readFloatAccelZ(), 3);

  Serial.print("   gyro dps  x=");
  Serial.print(myIMU.readFloatGyroX(), 1);
  Serial.print(" y=");
  Serial.print(myIMU.readFloatGyroY(), 1);
  Serial.print(" z=");
  Serial.println(myIMU.readFloatGyroZ(), 1);

  delay(200);
}
