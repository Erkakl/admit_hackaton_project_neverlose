import time
import sensor
import image
import lcd
from fpioa_manager import fm
from maix import GPIO

try:
    lcd.init(type=2, freq=20000000)
except Exception:
    lcd.init()

sensor.reset()
sensor.set_pixformat(sensor.RGB565)
sensor.set_framesize(sensor.QQVGA)
sensor.set_vflip(1)
sensor.set_hmirror(1)

sensor.set_auto_gain(True)
sensor.set_auto_whitebal(True)
sensor.set_contrast(2)
sensor.skip_frames(time=1000)
sensor.run(1)

fm.register(9, fm.fpioa.GPIO0, force=True)
btn_io9 = GPIO(GPIO.GPIO0, GPIO.IN, GPIO.PULL_UP)

fm.register(12, fm.fpioa.GPIO1, force=True)
btn_io12 = GPIO(GPIO.GPIO1, GPIO.IN, GPIO.PULL_UP)

fm.register(13, fm.fpioa.GPIOHS0, force=True)
fm.register(19, fm.fpioa.GPIOHS1, force=True)
fm.register(10, fm.fpioa.GPIOHS2, force=True)
fm.register(17, fm.fpioa.GPIOHS3, force=True)

l_ia = GPIO(GPIO.GPIOHS0, GPIO.OUT)
l_ib = GPIO(GPIO.GPIOHS1, GPIO.OUT)
r_ia = GPIO(GPIO.GPIOHS2, GPIO.OUT)
r_ib = GPIO(GPIO.GPIOHS3, GPIO.OUT)

def stop():
    l_ia.value(0)
    l_ib.value(0)
    r_ia.value(0)
    r_ib.value(0)

def forward():
    l_ia.value(1)
    l_ib.value(0)
    r_ia.value(1)
    r_ib.value(0)

def backward():
    l_ia.value(0)
    l_ib.value(1)
    r_ia.value(0)
    r_ib.value(1)

def turn_left():
    l_ia.value(0)
    l_ib.value(1)
    r_ia.value(1)
    r_ib.value(0)

def turn_right():
    l_ia.value(1)
    l_ib.value(0)
    r_ia.value(0)
    r_ib.value(1)

CENTER_X = 80
DEAD_ZONE = 25

clock = time.clock()

last_io9_state = 1
last_io12_state = 1

mode_tag = False
mode_gesture = False

GESTURE_THRESHOLD = [(15, 60, -20, 40, -20, 40)]

print("--- РОБОТ ГОТОВ К РАБОТЕ ---")

while True:
    clock.tick()
    img = sensor.snapshot()
    fps = clock.fps()

    curr_io9 = btn_io9.value()
    if last_io9_state == 1 and curr_io9 == 0:
        mode_tag = not mode_tag
        mode_gesture = False
        stop()
        time.sleep_ms(200)
    last_io9_state = curr_io9

    curr_io12 = btn_io12.value()
    if last_io12_state == 1 and curr_io12 == 0:
        mode_gesture = not mode_gesture
        mode_tag = False
        stop()
        time.sleep_ms(200)
    last_io12_state = curr_io12

    if mode_tag:
        tags = img.find_apriltags()

        if tags:
            tag = tags[0]
            cx = tag.cx()
            cy = tag.cy()

            img.draw_rectangle(tag.rect(), color=(0, 255, 0), thickness=2)
            img.draw_cross(cx, cy, color=(255, 0, 0), size=8)
            img.draw_string(5, 5, "MODE: APRILTAG", color=(0, 255, 0), scale=1)

            if cx < (CENTER_X - DEAD_ZONE):
                turn_left()
            elif cx > (CENTER_X + DEAD_ZONE):
                turn_right()
            else:
                if tag.w() > 90:
                    stop()
                    img.draw_string(5, 25, "TARGET REACHED", color=(0, 255, 255), scale=1)
                else:
                    forward()
        else:
            stop()
            img.draw_string(5, 5, "MODE: APRILTAG", color=(255, 255, 0), scale=1)
            img.draw_string(5, 25, "HET APRIL TAG", color=(255, 0, 0), scale=2)

    elif mode_gesture:
        img.draw_string(5, 5, "MODE: GESTURES", color=(255, 0, 255), scale=1)

        blobs = img.find_blobs(GESTURE_THRESHOLD, pixels_threshold=1000, area_threshold=1000)

        if blobs:
            hand = max(blobs, key=lambda b: b.pixels())
            img.draw_rectangle(hand.rect(), color=(255, 0, 255), thickness=2)

            bx = hand.cx()
            w = hand.w()
            h = hand.h()
            ratio = float(h) / w

            if ratio >= 1.4:
                forward()
                img.draw_string(5, 25, "GESTURE: FORWARD", color=(0, 255, 0), scale=1)
            elif ratio <= 0.7:
                backward()
                img.draw_string(5, 25, "GESTURE: BACKWARD", color=(255, 165, 0), scale=1)
            elif bx < (CENTER_X - 30):
                turn_left()
                img.draw_string(5, 25, "GESTURE: LEFT", color=(0, 255, 255), scale=1)
            elif bx > (CENTER_X + 30):
                turn_right()
                img.draw_string(5, 25, "GESTURE: RIGHT", color=(0, 255, 255), scale=1)
            else:
                stop()
                img.draw_string(5, 25, "GESTURE: STOP", color=(255, 255, 255), scale=1)
        else:
            stop()
            img.draw_string(5, 25, "NO GESTURE", color=(150, 150, 150), scale=1)

    else:
        stop()
        img.draw_string(5, 5, "IO9: TAG | IO12: GESTURE", color=(255, 255, 0), scale=1)
        img.draw_string(5, 25, "FPS: " + str(int(fps)), color=(0, 255, 255), scale=2)

    lcd.display(img, x_scale=2.0, y_scale=2.0)
