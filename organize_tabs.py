import os
import re
import shutil

tabs_dir = 'assets/tabs'


def get_base_name(filename):
    """Extract base name without extension and trailing page numbers."""
    name = os.path.splitext(filename)[0]
    # Remove trailing (N), （N）, （N patterns
    name = re.sub(r'\s*[（(]\d+[）)]?\s*$', '', name)
    # Remove common suffixes
    name = re.sub(r'\s*(简化版?|完整版?|超简版?)\s*$', '', name)
    return name.strip()


def group_images_by_version(image_files):
    """Group image files by version name."""
    groups = {}
    for f in sorted(image_files):
        base = get_base_name(f)
        if base.isdigit() or not base:
            base = '__pages__'
        if base not in groups:
            groups[base] = []
        groups[base].append(f)
    return groups


def organize_folder(path):
    """Organize a folder: if multiple image versions exist, create subfolders."""
    files = os.listdir(path)
    img_files = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'))]
    gp_files = [f for f in files if f.lower().endswith(('.gp', '.gp3', '.gp4', '.gp5', '.gp7', '.gp8', '.gpx'))]
    pdf_files = [f for f in files if f.lower().endswith('.pdf')]

    if not img_files:
        return  # No images to organize

    groups = group_images_by_version(img_files)

    if len(groups) <= 1:
        return  # Single version, no need to reorganize

    print(f"  Found {len(groups)} versions in {os.path.basename(path)}:")

    # Create subfolders for each version
    for version_name, version_files in groups.items():
        # Clean version name for folder
        folder_name = version_name.replace('/', '-').replace('\\', '-').strip()
        if not folder_name:
            folder_name = 'default'

        version_path = os.path.join(path, folder_name)

        # Check if folder already exists (don't overwrite)
        if os.path.exists(version_path):
            print(f"    - {folder_name} (exists, skip)")
            continue

        os.makedirs(version_path)
        print(f"    + {folder_name} ({len(version_files)} files)")

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

        has_subdirs = any(os.path.isdir(os.path.join(folder_path, d)) for d in os.listdir(folder_path))

        if has_subdirs:
            # This is a category folder (e.g., undertale, 明日方舟)
            scan_directory(folder_path, category=folder)
        else:
            # This is a song folder - check for multiple versions
            organize_folder(folder_path)


# Remove old versions dirs first
for root, dirs, files in os.walk(tabs_dir):
    if 'versions' in dirs:
        shutil.rmtree(os.path.join(root, 'versions'))
        print(f"Removed: {os.path.join(root, 'versions')}")

print("Organizing tabs...")
scan_directory(tabs_dir)
print("Done!")
