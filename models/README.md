# 3D Models Directory

Place your STL model files in this directory for the 3D viewer to display them.

## Supported Formats

- STL (Binary or ASCII)

## How to Add Models

1. Export your 3D models as STL files from your slicer or CAD software
2. Copy them to this directory
3. Update `config/models.json` to map print file names to these STL files

## Example

If you have a file named `benchy.stl` in this directory:

```json
{
  "benchy.3mf": {
    "modelFile": "benchy.stl",
    "displayName": "3D Benchy"
  }
}
```

## Tips

- Keep STL files under 10MB for better performance on Raspberry Pi
- Use lower polygon counts for faster loading
- Model files are served via HTTP at `/models/filename.stl`
