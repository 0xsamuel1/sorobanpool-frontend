# Adding a language

The app ships in English (`en`) and Nigerian Pidgin (`pcm`). This guide walks
through adding a third language. The example uses `ha` (Hausa). Replace it with
your code, using the two-letter ISO 639-1 code when one exists.

A new language touches several files, and the tests check that they agree.
Work through the steps in order. The checklist at the end is for reviewers.

## 1. Register the locale

Add the code to `locales` in [`i18n/request.ts`](../i18n/request.ts):

```ts
export const locales = ['en', 'pcm', 'ha'] as const;
```

The type `Locale` follows from this array. The request config reads the
`locale` cookie and falls back to `en` for anything unknown.

## 2. Create the message files

Copy the English files and translate the values. Keep every key exactly as it
is:

```bash
cp messages/en.json messages/ha.json
cp messages/errors.en.json messages/errors.ha.json
```

- `messages/ha.json` holds the UI copy.
- `messages/errors.ha.json` holds the text for contract errors. The keys are the
  error names in `messages/errors.en.json`. The codes themselves come from
  `lib/errors/errors.json`, which `scripts/sync-contract-artifacts.sh` copies from
  the contracts repo. Do not change codes or names in the translation.

Translate values only. Do not change keys, and do not change placeholders such
as `{count}`. ICU plural blocks keep their structure:

```json
"members": "{count, plural, one {# dey} other {# dey}}"
```

## 3. Add the option to Settings

`app/settings/page.tsx` has a language picker that writes the cookie. Its
`setLocale` function is typed `'en' | 'pcm'`, so widen it to `Locale` (imported
from `i18n/request.ts`) and add a button for the new language:

```tsx
<button
  aria-pressed={locale === 'ha'}
  onClick={() => setLocale('ha')}
  className={`${btn} ${locale === 'ha' ? 'border-emerald-800 bg-emerald-50' : ''}`}
>
  {t('hausa')}
</button>
```

Add the label key (`hausa` here) to every message file, including the English
one. The language name is written in that language, so `ha` reads "Hausa".

## 4. Update the tests

Tests that list the languages by hand must include the new one:

- [`lib/messages.test.ts`](../lib/messages.test.ts) imports `en` and `pcm`
  explicitly. Add the new file, and add it to the loops in the banned-terms
  and empty-string checks. The key-parity and placeholder tests only pass when
  the new file is listed.
- [`tests/e2e/a11y.spec.ts`](../tests/e2e/a11y.spec.ts) loops over
  `['en', 'pcm']` for the axe scan. Add the new code so the new language gets
  the contrast and label checks.

Run the unit tests and typecheck:

```bash
pnpm test
pnpm typecheck
```

## 5. Check the rendering

- **Fonts.** The app uses the system font stack and loads no web font (see
  [ADR 0002](decisions/0002-pwa-and-performance-budget.md)). Check that the
  language's letters, including any tone marks or diacritics, render on a phone
  with the system font. If they do not, open an ADR before adding a font.
- **Numbers, dates and money.** Format with `Intl` and the active locale, not
  with hard-coded separators. Check amounts and dates on the home and pool
  screens.
- **Length.** Translations are often longer than English. Check the header, the
  tab labels and the join panel at 360px wide for overflow.

## 6. Get a native-speaker review

A translator's first draft is not enough. Before merging, a reviewer who is a
native speaker reads every value in `messages/ha.json` and
`messages/errors.ha.json`, and checks that:

- money, deadline and penalty wording means what the English means;
- the wording is plain, as in [`ux-writing.md`](ux-writing.md);
- no English is left in the file, apart from brand names.

Record the reviewer in the PR description. The review is required for any
change to the wording of a payment, dispute or bond message.

## Partial translations

The tests require every key in every language. A half-finished file therefore
fails CI, which is the intent. Do not work around the test by copying English
into missing keys and merging that.

Safe path:

1. Keep the work on a branch and open the PR as a **draft**.
2. Leave the `locales` entry and the Settings option out of `main` until every
   key is translated and reviewed.
3. Merge the complete file, the locale entry and the Settings option in one PR.

Users then never see a screen that is half in one language and half in another.

## Worked example

A dummy `ha` locale on a scratch branch takes about an hour if the English
files are complete:

1. Add `ha` to `locales` in `i18n/request.ts`.
2. Copy the two English files to `messages/ha.json` and
   `messages/errors.ha.json`, and translate the values.
3. Add the Settings button and widen `setLocale`.
4. Add `ha` to the test lists in `lib/messages.test.ts` and
   `tests/e2e/a11y.spec.ts`.
5. Run `pnpm test` and `pnpm typecheck`.
6. Open the Settings page, switch to `ha`, and walk through onboarding.

Write down anything that took longer than it should. Those notes are the
friction this guide is meant to remove.

## Reviewer checklist

- [ ] `ha` is in `locales` in `i18n/request.ts`, and the Settings option works.
- [ ] `messages/ha.json` and `messages/errors.ha.json` have every key that
      `en` has, with no extras and no empty values.
- [ ] Placeholders and ICU plural blocks match English.
- [ ] `lib/messages.test.ts` and `tests/e2e/a11y.spec.ts` include the locale.
- [ ] A native speaker has reviewed the files, and the reviewer is named in the PR.
- [ ] Payment, dispute and bond wording was checked against the English.
- [ ] Letters render with the system font, and the screens fit at 360px.
- [ ] No partial translation is merged.
