import json
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))
from server.tests.test_optical_task_scheduler import transcript
print(json.dumps(transcript(json.load(sys.stdin))))
