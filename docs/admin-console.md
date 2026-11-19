# Admin and arbiter console

The admin console lives under `/admin` and the arbiter queue under `/arbiter`. The server enforces the `ADMIN` and `ARBITER` roles on every endpoint; the app only hides and redirects.

## Sessions

Staff sessions end after a period of inactivity. The timeout is set at build time:

- `NEXT_PUBLIC_STAFF_IDLE_MINUTES`: minutes of inactivity before the session ends. Defaults to 15.

For the last 60 seconds, a dialog asks whether to stay signed in. Pointer, key, touch and scroll activity keeps the session alive until the dialog appears; after that only the dialog's button extends it. On timeout the app signs out, clears cached API responses and forgets a passkey wallet, then sends the person to sign in again.

## Parameters and categories

Both screens prepare transactions for multisig signers rather than changing anything directly. The app shows the transaction XDR for download or copy.

- `GET /v1/admin/params` returns `{ params: ParamSpec[] }`. Each spec carries the current value and the hard `min` and `max`. Edits outside those caps are refused in the app and must be refused by the server too.
- `POST /v1/admin/params/proposals` takes `{ changes: { [key]: number } }` and returns `{ txXdr }`.
- `GET /v1/admin/categories` returns `CategoryRow[]`. `onChain` is `null` when the chain has no entry for the category yet.
- `POST /v1/admin/categories/{id}/toggle/prepare` takes `{ enabled }` and returns `{ txXdr }`.

These endpoints are not yet in `docs/openapi.json`. Agree their shape with the backend before merging.

## Risk overview

`GET /v1/admin/risk/overview?window=7|30|90` returns the same overview as before. The time window selector only changes what the app asks for; the backend must honour `window`, or the numbers stay on the 7-day basis.
