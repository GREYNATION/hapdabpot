import sys
import json
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
        print(json.dumps({"error": "missing_args", "description": "Usage: python video_agent.py <youtube_url>"}))
        sys.exit(1)
        
    url = sys.argv[1]
    video_id = extract_video_id(url)
    
    if not video_id:
        print(json.dumps({"error": "invalid_url", "description": f"Could not extract video ID from '{url}'"}))
        sys.exit(1)

    try:
        # Try fetching the transcript with fallbacks
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'en-US', 'a.en'])
        except Exception:
            # Try to list available transcripts and take the first one
            try:
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id).find_transcript(['en', 'en-US', 'a.en']).fetch()
            except Exception:
                # Last resort: take any available
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id).find_generated_transcript(['en']).fetch()

        # Combine text segments into a single string
        full_text = " ".join([t['text'] for t in transcript_list])
        
        # Output JSON result
        print(json.dumps({
            "video_id": video_id,
            "transcript": full_text,
            "length": len(full_text)
        }))
        
    except Exception as e:
        print(json.dumps({
            "error": "no_transcript",
            "video_id": video_id,
            "description": str(e)
        }))
        sys.exit(0) # Exit with 0 so Node can parse the JSON error instead of crashing

if __name__ == "__main__":
    main()
