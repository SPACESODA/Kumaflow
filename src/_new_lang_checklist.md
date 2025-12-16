# Adding New Languages - Checklist

To add a new language, update these files:

- `src/types.ts`: Add '*' to LanguageCode type (* is the language code).
- `src/locales/*.json`: Prepare the MAIN translations (via POEditor).
- `src/locales-extension/*.json`: Prepare the extension's UI translations.
- `src/content/scripts.ts`: Import `src/locales/*.json` and add to BUNDLED_LANGUAGES object.
- `src/options/OptionsApp.ts`: Import `src/locales-extension/*.json`, add to LANGUAGES array, and add to EXTENSION_LOCALES.
- `src/content/injections.ts`: Add new language options.
- `.github/scripts/pull-poeditor.mjs`: Add 'fr' to the list for pulling from POEditor.
- `_locales/*/messages.json`: Create extension metadata for Chrome Web Store.

Content updates:

- `src/locales/index.html`: Add new languages to the list.
- `src/options/index.html`: Add translations.
- `index.html`: Add new languages to intro and meta tags.
