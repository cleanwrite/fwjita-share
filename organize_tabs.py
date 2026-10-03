import os
import re
import shutil

tabs_dir = 'assets/tabs'


def get_base_name(filename):
    """Extract base name without extension and trailing page numbers."""
    name = os.path.splitext(filename)[0]
    # Remove trailing (N), （N）, （N patterns — these are PAGE numbers, not versions
    name = re.sub(r'\s*[（(]\d+[）)]?\s*$', '', name)
    # Remove common suffixes
    name = re.sub(r'\s*(简化版?|完整版?|超简版?)\s*$', '', name)
    return name.strip()


def should_split_into_versions(image_files):
    """
    Determine if images should be split into separate version subfolders.
    Only split if there are clearly different song versions (e.g. HIS THEME vs 也是his theme).
    Do NOT split if files are just page numbers of the same version.
    """
    base_names = set()
    for f in image_files:
        base = get_base_name(f)
        # If base name is empty or just a number, it's a page — don't split
        if not base or base.isdigit():
            continue
        base_names.add(base)

    # Only split if there are multiple DISTINCT base names (not pages)
    return len(base_names) > 1


def organize_folder(path):
    """Organize a folder: if multiple distinct versions exist, create subfolders."""
    files = [f for f in os.listdir(path) if not f.startswith('.') and f != 'versions']
    img_files = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'))]

    if len(img_files) <= 1:
        return

    if not should_split_into_versions(img_files):
        return  # All pages of same version, no need to split

    # Group by version name
    groups = {}
    for f in sorted(img_files):
        base = get_base_name(f)
        if not base or base.isdigit():
            base = '__default__'
        if base not in groups:
            groups[base] = []
        groups[base].append(f)

    if len(groups) <= 1:
        return

    print(f"  Splitting {os.path.basename(path)} into {len(groups)} versions:")
    for version_name, version_files in groups.items():
        folder_name = version_name.replace('/', '-').replace('\\', '-').strip()
        if not folder_name or folder_name == '__default__':
            folder_name = os.path.basename(path)

        version_path = os.path.join(path, folder_name)

        if os.path.exists(version_path) and os.path.isdir(version_path):
            print(f"    - {folder_name} (exists, skip)")
            continue

        os.makedirs(version_path)
        print(f"    + {folder_name} ({len(version_files)} imgs)")

        for f in version_files:
            src = os.path.join(path, f)
            dst = os.path.join(version_path, f)
            shutil.move(src, dst)


def scan_directory(path, category='单曲'):
    """Recursively scan and organize tabs directory."""
    for folder in sorted(os.listdir(path)):
        folder_path = os.path.join(path, folder)
        if not os.path.isdir(folder_path):
            continue

        # Skip 'versions' dirs
        if folder == 'versions':
            continue

        # Check if this folder has subdirs (that aren't 'versions')
        has_subdirs = any(
            os.path.isdir(os.path.join(folder_path, d))
            and d != 'versions'
            and not d.startswith('.')
            for d in os.listdir(folder_path)
        )

        if has_subdirs:
            scan_directory(folder_path, category=folder)
        else:
            organize_folder(path=folder_path)


# Remove old versions dirs
for root, dirs, files in os.walk(tabs_dir):
    if 'versions' in dirs:
        shutil.rmtree(os.path.join(root, 'versions'))
        print(f"Removed: {os.path.join(root, 'versions')}")

print("Organizing tabs...")
scan_directory(tabs_dir)
print("Done!")
