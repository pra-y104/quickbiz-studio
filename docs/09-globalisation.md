# Globalisation and localisation

QuickBiz Studio is built for users worldwide. Nigeria is the first payment market,
not the product boundary.

## Rules

1. No hard-coded currency. Prices carry an ISO 4217 code and an integer minor unit.
2. No hard-coded country behaviour. Country affects defaults, not capabilities.
3. No local time assumption. Timestamps are stored in UTC and rendered in the user's
   IANA time zone.
4. No hard-coded copy in components. Text goes through the translation catalogue.
5. No assumption that a phone number is Nigerian.

## Locales

- English (`en`) ships first.
- Additional locales are added by creating `src/i18n/locales/<code>.json` and
  registering the code in `packages/shared/src/types/locale.ts`.
- Layout uses logical CSS properties so right-to-left languages do not require a rewrite.
- `LocaleDefinition.complete` marks whether a translation is safe to show publicly.

## Currency

`packages/shared/src/types/currency.ts` holds the supported list with decimal digits
per currency (JPY 0, NGN 2). `formatMoney` formats integer minor units and throws on
invalid input instead of displaying a wrong number.

- Display: `Intl.NumberFormat` with the user's locale.
- Storage: integer minor units + currency code.
- Pricing per region: `credit_packages.country_scope` (`NG` or `*`).
- A currency can exist in the catalogue while disabled for checkout (`enabled: false`).

## Dates and times

- Database: `timestamptz`, UTC.
- API: ISO 8601 strings with an explicit offset.
- UI: `formatDateTime` / `formatDate` / `formatRelativeTime` with an explicit locale
  and time zone, defaulting to UTC so nothing silently shifts.

## Phone numbers and addresses

- Phone is optional, validated with a country selector (Stage 4).
- Address fields are free-form and optional; they are never assumed to be a Nigerian
  format.

## Pricing display

- The price shown always includes the currency code, and the credit amount is shown
  separately from the money amount.
- Credit cost is shown before any paid action, in the interface language.
- Exchange rates are never invented: a regional price is an explicit stored number.

## Regional payments (planned)

| Market | Provider | Status |
|---|---|---|
| Nigeria | Paystack (primary candidate) | Stage 8, fees and onboarding to be verified from official sources |
| Global | Merchant of record (Paddle / Lemon Squeezy) | Later, requires approval |

No provider fee is quoted in this repository until it has been verified from the
provider's own documents.

## Locale-aware testing

- Numbers: 1,000.50 vs 1.000,50
- Dates: 31/12/2026 vs 12/31/2026
- Currency symbols: ₦, $, €, £, ¥
- Text expansion: German-like long compounds should not break buttons
