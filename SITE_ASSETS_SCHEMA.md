# Site Assets JSON Schema

This document describes the JSON schema for `site-assets.json` files used by static sites to define manageable assets.

## Schema Location

The JSON schema is available at: `/site-assets.schema.json`

## Usage

To validate your `site-assets.json` file against this schema, add the `$schema` property at the root:

```json
{
  "$schema": "./site-assets.schema.json",
  "version": "1.0",
  "assets": [...]
}
```

## Root Structure

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `version` | string | ✅ | Schema version (format: "X.Y") |
| `description` | string | ❌ | Optional description of the configuration |
| `assets` | array | ✅ | Array of asset definitions |

## Asset Object Properties

### Required Properties

| Property | Type | Description |
|----------|------|-------------|
| `path` | string | Relative path to the asset from repository root |
| `type` | string | Asset type (see [Asset Types](#asset-types)) |

### Optional Properties

| Property | Type | Description |
|----------|------|-------------|
| `label` | string | Human-readable label for the asset |
| `description` | string | Detailed description of the asset |
| `maxSize` | integer | Maximum file size in bytes |
| `allowedExtensions` | array | Allowed file extensions (e.g., `[".jpg", ".png"]`) |
| `schema` | object | JSON Schema for structured data assets |
| `metadata` | object | Additional metadata (see [Metadata](#metadata)) |
| `contains` | object | For directories, defines allowed contents (see [Contains](#contains)) |

## Asset Types

Supported asset types:
- `image` - Image files (JPEG, PNG, WebP, SVG, etc.)
- `video` - Video files
- `audio` - Audio files
- `text` - Plain text files
- `markdown` - Markdown files
- `html` - HTML files
- `css` - CSS stylesheets
- `javascript` - JavaScript files
- `document` - Documents (PDF, Word, etc.)
- `data` - Generic data files
- `json` - JSON data files
- `calendar` - Calendar/event data
- `directory` - Directory containing multiple assets

## Metadata

The `metadata` object provides additional configuration:

| Property | Type | Description |
|----------|------|-------------|
| `externalSync` | boolean | Whether asset syncs with external source |
| `calendarType` | string | Type of calendar: `"local"` or `"external"` |
| `availableProviders` | array | External providers: `["google", "apple", "outlook", "ical"]` |
| `syncInterval` | string | Sync frequency: `"realtime"`, `"hourly"`, `"daily"`, `"weekly"`, `"manual"` |

## Contains

For `directory` type assets, the `contains` object defines what the directory can hold:

| Property | Type | Description |
|----------|------|-------------|
| `type` | string | Type of assets allowed in directory |
| `allowedExtensions` | array | File extensions allowed |
| `maxSize` | integer | Max file size per file in bytes |
| `schema` | object | JSON Schema for structured files |
| `parts` | array | Multi-part asset definitions |

## Examples

### Basic Image Asset

```json
{
  "version": "1.0",
  "assets": [
    {
      "path": "images/hero.jpg",
      "type": "image",
      "label": "Hero Image",
      "description": "Main homepage hero image",
      "maxSize": 2097152,
      "allowedExtensions": [".jpg", ".png", ".webp"]
    }
  ]
}
```

### Text/Markdown Asset

```json
{
  "path": "content/about.md",
  "type": "text",
  "label": "About Page Content",
  "description": "Markdown content for the about page",
  "maxSize": 51200,
  "allowedExtensions": [".md"]
}
```

### Directory Asset

```json
{
  "path": "images/gallery",
  "type": "directory",
  "label": "Photo Gallery",
  "description": "Collection of gallery images",
  "contains": {
    "type": "image",
    "maxSize": 2097152,
    "allowedExtensions": [".jpg", ".png", ".webp"]
  }
}
```

### Calendar Asset (Local Events)

```json
{
  "path": "data/events.json",
  "type": "calendar",
  "label": "Events Calendar",
  "description": "Manage your calendar events",
  "maxSize": 1048576,
  "allowedExtensions": [".json"],
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "title": "Event ID"
        },
        "title": {
          "type": "string",
          "title": "Event Title"
        },
        "startDate": {
          "type": "string",
          "title": "Start Date"
        },
        "endDate": {
          "type": "string",
          "title": "End Date"
        }
      }
    }
  }
}
```

### Calendar Asset (External Integration)

```json
{
  "path": "data/calendar-config.json",
  "type": "calendar",
  "label": "External Calendar",
  "description": "Calendar synced with external provider",
  "maxSize": 102400,
  "allowedExtensions": [".json"],
  "metadata": {
    "calendarType": "external",
    "availableProviders": ["google", "outlook"],
    "syncInterval": "hourly"
  },
  "schema": {
    "type": "object",
    "properties": {
      "provider": {
        "type": "string",
        "enum": ["google", "outlook"]
      },
      "calendarId": {
        "type": "string"
      },
      "displayName": {
        "type": "string"
      }
    }
  }
}
```

### Complete Example

```json
{
  "$schema": "./site-assets.schema.json",
  "version": "1.0",
  "description": "Asset configuration for my static site",
  "assets": [
    {
      "path": "images/hero.jpg",
      "type": "image",
      "label": "Hero Image",
      "description": "Main homepage hero image",
      "maxSize": 2097152,
      "allowedExtensions": [".jpg", ".png", ".webp"]
    },
    {
      "path": "images/logo.png",
      "type": "image",
      "label": "Site Logo",
      "description": "Primary logo displayed in header",
      "maxSize": 524288,
      "allowedExtensions": [".png", ".svg", ".webp"]
    },
    {
      "path": "content/about.md",
      "type": "text",
      "label": "About Page Content",
      "description": "Markdown content for the about page",
      "maxSize": 51200,
      "allowedExtensions": [".md"]
    },
    {
      "path": "images/gallery",
      "type": "directory",
      "label": "Photo Gallery",
      "description": "Collection of gallery images",
      "contains": {
        "type": "image",
        "maxSize": 2097152,
        "allowedExtensions": [".jpg", ".png", ".webp"]
      }
    },
    {
      "path": "data/events.json",
      "type": "calendar",
      "label": "Events Calendar",
      "description": "Company events and calendar",
      "maxSize": 1048576,
      "allowedExtensions": [".json"]
    }
  ]
}
```

## Validation

You can validate your `site-assets.json` file using any JSON Schema validator:

### Using Node.js (ajv)

```bash
npm install ajv ajv-cli
ajv validate -s site-assets.schema.json -d site-assets.json
```

### Using VS Code

Add the schema reference to your `site-assets.json` file, and VS Code will automatically validate it if you have JSON validation enabled.

### Using Online Tools

- [JSON Schema Validator](https://www.jsonschemavalidator.net/)
- [JSON Schema Lint](https://jsonschemalint.com/)

## Best Practices

1. **Always specify a version**: Use semantic versioning (e.g., "1.0")
2. **Use clear labels**: Make labels descriptive for non-technical users
3. **Set reasonable size limits**: Balance quality with performance
4. **Document with descriptions**: Help users understand each asset's purpose
5. **Use specific extensions**: Limit to necessary formats
6. **Validate before deployment**: Always validate against the schema
7. **Reference the schema**: Add `$schema` property for IDE support

## Related Files

- [CALENDAR_ASSETS_GUIDE.md](./CALENDAR_ASSETS_GUIDE.md) - Detailed guide for calendar assets
- [examples/calendar-assets-config.json](./examples/calendar-assets-config.json) - Calendar asset examples
- Site assets template in [supabase/functions/create-site-assets-pr/index.ts](./supabase/functions/create-site-assets-pr/index.ts)

## Support

For questions or issues with the schema, please refer to the documentation or contact support.
