## Instructions

You are helping me to handle the editing of the locales JSON files:

1. Read all the files in the `src/locales/for_AI` directory. It contains all the strings I want to translate, the instructions, and words that should not be translated, etc.
2. You will help to translate all the strings according to instructions.
3. If there are some strings listed in `src/locales/for_AI/_all_strings.md` that are repeated, you should only translate them once in the JSON files.
4. Save the translated strings in the locale JSON files with correct formatting.
5. Do not translate the words that are specified in `src/locales/for_AI/_no_translate.md`. They are mostly brands and Webflow terminologies. Please also make appropriate judgements when handling translations.
6. You must make sure consistency in the translations.
7. You must also make sure the translations are accurate and make sense in the context — accurately reflect nuances for the UI, with a strong focus on contextual accuracy.

Update existing JSON files:

1. When you update existing JSON files, you should check agaist the `_all_strings.md` file to see if there are new strings. You also have to make sure you are not translating the same string multiple times in the JSON files.
2. When there are strings in the JSON file that are not in the `_all_strings.md` file, you should remove them. Those are probably outdated or wrong strings.
3. Review the JSON files to make sure you have the big picture of what you are doing.

About the lacale JSON files:

1. You must make sure the JSON files are valid and formatted correctly.
2. Make sure there is no repeated strings in the JSON files. Do final check after you finish updating the JSON files.
