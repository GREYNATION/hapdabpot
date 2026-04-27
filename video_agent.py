import sys
import urllib.parse as urlparse
from youtube_transcript_api import YouTubeTranscriptApi

def extract_video_id(url):
    """Extract the video ID from a YouTube URL."""
    try:
        parsed = urlparse.urlparse(url)
        if parsed.hostname in ('youtu.be', 'www.youtu.be'):
            return parsed.path[1:]
        if parsed.hostname in ('youtube.com', 'www.youtube.com'):
            if parsed.path == '/watch':
                qs = urlparse.parse_qs(parsed.query)
                return qs['v'][0]
            if parsed.path.startswith('/shorts/'):
                return parsed.path.split('/')[2]
            if parsed.path.startswith('/embed/'):
                return parsed.path.split('/')[2]
    except Exception:
        pass
    return None

def main():
    if len(sys.argv) < 2:
        print("Usage: python video_agent.py <youtube_url>")
        sys.exit(1)
        
    url = sys.argv[1]
    video_id = extract_video_id(url)
    
    if not video_id:
        print(f"Error: Could not extract YouTube video ID from URL '{url}'")
        sys.exit(1)

    try:
        # Fetch the transcript
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        
        # Combine text segments into a single string
        full_text = " ".join([t['text'] for t in transcript_list])
        
        # Print directly to stdout for the Node.js exec to capture
        print(full_text)
        
    except Exception as e:
        print(f"Error fetching transcript for {video_id}: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
