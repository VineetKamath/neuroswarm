import glob

for path in glob.glob('backend/**/*.py', recursive=True):
    with open(path, 'rb') as f:
        content = f.read()
    if content.startswith(b'\xef\xbb\xbf'):
        content = content[3:]
        with open(path, 'wb') as f:
            f.write(content)
        print('Cleaned BOM in', path)
