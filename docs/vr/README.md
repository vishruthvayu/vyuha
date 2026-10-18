# VYUHA VR

This is the new experimental VR implementation in the working tree, added after v1.0.1. It reuses VYUHA’s simulation, instructor commands, recovery, scoring and review.

- **For a beginner:** [illustrated browser guide](../../client/public/vr-guide.html), served at `/vr-guide.html`, or [printable PDF](VYUHA-VR-GUIDE.pdf).
- **Try now:** start the app, open Training ground, then **Open VR cockpit**. Use the desktop controls without a headset.
- **With a headset later:** use trusted HTTPS and `bash scripts/start-vr.sh --build`. Section 05 of the guide explains certificates and networking.
- **Evidence:** [validation report](VALIDATION.md), [browser results](evidence/browser-results.json), and screenshots in `evidence/`.
- **Repeat browser checks:** build the client, then run `.venv/bin/python scripts/test-vr-browser.py`. Python Playwright and its Chromium browser are needed. IWER is installed by `npm ci` as a development dependency.

No physical headset was available. Hardware compatibility, comfort, tracking and sustained headset performance are not established by the software evidence.
