import os
import glob

def replace_in_files(file_pattern, old_str, new_str):
    for filepath in glob.glob(file_pattern, recursive=True):
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        if old_str in content:
            content = content.replace(old_str, new_str)
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"Updated {filepath}")

def main():
    replace_in_files('app/**/*.tsx', 'indigo', 'ocean')
    replace_in_files('components/**/*.tsx', 'indigo', 'ocean')
    replace_in_files('app/**/*.css', 'indigo', 'ocean')

if __name__ == '__main__':
    main()
