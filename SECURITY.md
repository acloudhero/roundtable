# Security Notes

RoundTable is designed as a local-first static PWA.

## Intentional Trust Boundaries

- No backend service
- No authentication layer
- No model API calls
- No browser automation
- No scraping
- No cloud database
- No runtime fetch/XHR/WebSocket/EventSource/sendBeacon surfaces in app code

User data is stored in the browser through the local storage adapter and can be exported manually by the operator.

## Sensitive Data Guidance

Do not commit real project exports, private model responses, customer data, credentials, or `.env` files to this repository.

Use demo data for screenshots, walkthroughs, and portfolio presentations.
