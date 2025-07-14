# S3 Image Processor

A Node.js application that downloads images from an S3 bucket, processes them into multiple sizes, and reuploads them with public ACL and organized naming.
Originally this was made for a Roku app we run. Because we needed to go back to buckets that had images and resize them. So you will need to modify the code if
you have different image size requirements.

It downloads the images, resizes them, then uploads them to the same path renamed. Then shows a list of the URLs.

## Features

- 🔍 **Automatic Discovery**: Lists all images in the specified S3 bucket or folder
- 📁 **Folder Support**: Process images from specific folders like `path/to/images`
- 📥 **Download**: Downloads images to temporary local storage
- 🖼️ **Image Processing**: Creates multiple sizes using Sharp
- 📤 **Reupload**: Uploads processed images with public ACL
- 🏷️ **Organized Naming**: Uses consistent naming convention with size prefixes
- 📊 **Progress Tracking**: Real-time progress indicators and status updates
- 🧹 **Cleanup**: Automatically cleans up temporary files

## Image Sizes Generated

For each original image, the app creates 4 versions:

1. **Original Size**: `filename-default.ext`
2. **SD (320x180)**: `filename-sd_320x180.ext`
3. **HD (1280x720)**: `filename-hd_1280x720.ext`
4. **FHD (1920x1080)**: `filename-fhd_1920x1080.ext`

## Supported Image Formats

- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- BMP (.bmp)
- WebP (.webp)

## Prerequisites

- Node.js 16+ installed
- AWS credentials configured
- S3 bucket with appropriate permissions

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```

## AWS Setup

### Option 1: Environment Variables

**Linux/macOS:**
```bash
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1  # Optional, defaults to us-east-1
```

**Windows PowerShell:**
```powershell
$env:AWS_ACCESS_KEY_ID="your_access_key"
$env:AWS_SECRET_ACCESS_KEY="your_secret_key"
$env:AWS_REGION="us-east-1"
```

**Windows Command Prompt:**
```cmd
set AWS_ACCESS_KEY_ID=your_access_key
set AWS_SECRET_ACCESS_KEY=your_secret_key
set AWS_REGION=us-east-1
```

**Windows (Permanent):**
1. Press `Windows + R`, type `sysdm.cpl`, press Enter
2. Click "Environment Variables" button
3. Add new User variables:
   - `AWS_ACCESS_KEY_ID` = your_access_key
   - `AWS_SECRET_ACCESS_KEY` = your_secret_key
   - `AWS_REGION` = us-east-1

### Option 2: AWS CLI Configuration
Configure AWS CLI:
```bash
aws configure
```

### Option 3: IAM Roles
If running on EC2 or other AWS services, use IAM roles.

## Required S3 Permissions

Your AWS credentials need the following S3 permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket",
                "s3:GetObject",
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": [
                "arn:aws:s3:::your-bucket-name",
                "arn:aws:s3:::your-bucket-name/*"
            ]
        }
    ]
}
```

## Usage

1. Run the application:
   ```bash
   npm start
   ```

2. Enter your S3 bucket name when prompted
3. Enter the folder path (e.g., `path/to/images`) or leave empty for root folder

3. The app will:
   - List all images in the bucket
   - Download each image
   - Process into multiple sizes
   - Upload processed images with public ACL
   - Display the public URLs for each processed image

## Example Output

```
🚀 S3 Image Processor

✅ Using bucket: my-image-bucket
✅ Using folder: path/to/images
📁 Temporary directory: /tmp/s3-processor-1234567890

✅ Found 3 images in bucket folder: path/to/images

📋 Processing 3 images...

✅ Processed photo1.jpg (4 sizes)
✅ Processed photo2.png (4 sizes)
✅ Processed photo3.gif (4 sizes)

🎉 Processing Complete!

📸 photo1.jpg
  default: https://my-image-bucket.s3.us-east-1.amazonaws.com/path/to/images/photo1-default.jpg
  sd_320x180: https://my-image-bucket.s3.us-east-1.amazonaws.com/path/to/images/photo1-sd_320x180.jpg
  hd_1280x720: https://my-image-bucket.s3.us-east-1.amazonaws.com/path/to/images/photo1-hd_1280x720.jpg
  fhd_1920x1080: https://my-image-bucket.s3.us-east-1.amazonaws.com/path/to/images/photo1-fhd_1920x1080.jpg

✅ Total images processed: 3
✅ Total processed versions: 12
```

## File Structure

```
s3Image/
├── index.js          # Main application file
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

## Error Handling

The application includes comprehensive error handling:
- Invalid bucket names
- Missing AWS credentials
- Network connectivity issues
- Image processing errors
- Upload failures

Failed operations are logged but don't stop the entire process.

## Performance Notes

- Images are processed sequentially to avoid memory issues
- Temporary files are automatically cleaned up
- Progress indicators show real-time status
- Large images may take longer to process

## Troubleshooting

### Common Issues

1. **AWS Credentials Error**
   - Ensure AWS credentials are properly configured
   - Check environment variables or AWS CLI configuration

2. **Permission Denied**
   - Verify S3 bucket permissions
   - Ensure bucket allows public read access for uploaded objects

3. **Image Processing Failures**
   - Check if images are corrupted
   - Verify supported image formats

4. **Memory Issues**
   - For very large images, consider processing in smaller batches
   - Ensure sufficient system memory

## License

MIT License - feel free to use and modify as needed. 
