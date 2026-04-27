import ctypes

# Set cursor position
ctypes.windll.user32.SetCursorPos(960, 540)

# Simulate left click
# MOUSEEVENTF_LEFTDOWN = 0x0002
# MOUSEEVENTF_LEFTUP = 0x0004
ctypes.windll.user32.mouse_event(0x0002, 960, 540, 0, 0)
ctypes.windll.user32.mouse_event(0x0004, 960, 540, 0, 0)

print("Clicked at 960, 540")
