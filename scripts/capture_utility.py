import sys
import requests
import pyperclip
import os

# Configuration
API_URL = os.getenv("HAPDABOT_API_URL", "http://localhost:8080/api/archive")
CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "0") # Set to your Telegram ID to get a notification

def archive_content(content):
    """Sends content (URL or text) to Hapdabot for archiving."""
    print(f"📚 Sending content to Librarian: {content[:50]}...")
    
    payload = {
        "url" if content.startswith("http") else "text": content,
        "chatId": int(CHAT_ID)
    }
    
    try:
        response = requests.post(API_URL, json=payload, timeout=10)
        if response.status_code == 200:
            print("✅ Content queued successfully!")
        else:
            print(f"❌ Failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    # 1. Check if content provided via CLI
    content = sys.argv[1] if len(sys.argv) > 1 else None
    
    # 2. If no CLI, check clipboard
    if not content:
        content = pyperclip.paste()
    
    if not content:
        print("❌ No content found in CLI or clipboard.")
        sys.exit(1)
        
    archive_content(content.strip())
