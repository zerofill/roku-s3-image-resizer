import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class S3ImageProcessor {
    constructor() {
        this.s3Client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1'
        });
        this.bucketName = '';
        this.folderPath = '';
        this.makePublic = true;
        this.tempDir = '';
        this.imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
        this.sizes = [
            { name: 'default', width: null, height: null },
            { name: 'sd_320x180', width: 320, height: 180 },
            { name: 'hd_1280x720', width: 1280, height: 720 },
            { name: 'fhd_1920x1080', width: 1920, height: 1080 }
        ];
    }

    async initialize() {
        console.log(chalk.blue.bold('🚀 S3 Image Processor\n'));
        
        // Get bucket name and folder path from user
        const answers = await inquirer.prompt([
            {
                type: 'input',
                name: 'bucketName',
                message: 'Enter the S3 bucket name:',
                validate: (input) => input.trim() ? true : 'Bucket name is required'
            },
            {
                type: 'input',
                name: 'folderPath',
                message: 'Enter the folder path in the bucket (e.g., icuvids/2/thumbnails) or leave empty for root:',
                default: ''
            },
            {
                type: 'confirm',
                name: 'makePublic',
                message: 'Do you want to make the uploaded images publicly accessible?',
                default: true
            }
        ]);

        this.bucketName = answers.bucketName.trim();
        this.folderPath = answers.folderPath.trim();
        this.makePublic = answers.makePublic;
        
        // Create temporary directory
        this.tempDir = path.join(os.tmpdir(), `s3-processor-${Date.now()}`);
        await fs.mkdir(this.tempDir, { recursive: true });
        
        console.log(chalk.green(`✅ Using bucket: ${this.bucketName}`));
        if (this.folderPath) {
            console.log(chalk.green(`✅ Using folder: ${this.folderPath}`));
        } else {
            console.log(chalk.green(`✅ Using root folder`));
        }
        console.log(chalk.green(`✅ Public access: ${this.makePublic ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`📁 Temporary directory: ${this.tempDir}\n`));
    }

    async listImages() {
        const folderDisplay = this.folderPath || 'root';
        const spinner = ora(`Listing images in bucket folder: ${folderDisplay}...`).start();
        
        try {
            const command = new ListObjectsV2Command({
                Bucket: this.bucketName,
                Prefix: this.folderPath ? `${this.folderPath}/` : undefined
            });
            
            const response = await this.s3Client.send(command);
            const images = response.Contents?.filter(obj => {
                const ext = path.extname(obj.Key).toLowerCase();
                return this.imageExtensions.includes(ext);
            }) || [];
            
            spinner.succeed(`Found ${images.length} images in bucket folder: ${folderDisplay}`);
            return images;
        } catch (error) {
            spinner.fail('Failed to list images');
            throw error;
        }
    }

    async downloadImage(key) {
        const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key
        });
        
        const response = await this.s3Client.send(command);
        const chunks = [];
        
        for await (const chunk of response.Body) {
            chunks.push(chunk);
        }
        
        const buffer = Buffer.concat(chunks);
        const localPath = path.join(this.tempDir, path.basename(key));
        await fs.writeFile(localPath, buffer);
        
        return localPath;
    }

    async processImage(imagePath, originalKey) {
        const results = [];
        const baseName = path.basename(originalKey, path.extname(originalKey));
        const extension = path.extname(originalKey);
        
        for (const size of this.sizes) {
            try {
                let processedBuffer;
                
                if (size.width && size.height) {
                    // Resize image
                    processedBuffer = await sharp(imagePath)
                        .resize(size.width, size.height, {
                            fit: 'inside',
                            withoutEnlargement: true
                        })
                        .toBuffer();
                } else {
                    // Keep original size
                    processedBuffer = await sharp(imagePath).toBuffer();
                }
                
                const newKey = this.folderPath ? `${this.folderPath}/${baseName}-${size.name}${extension}` : `${baseName}-${size.name}${extension}`;
                results.push({
                    key: newKey,
                    buffer: processedBuffer,
                    size: size.name
                });
                
            } catch (error) {
                console.log(chalk.red(`❌ Failed to process ${originalKey} to ${size.name}: ${error.message}`));
            }
        }
        
        return results;
    }

    async uploadImage(key, buffer) {
        const uploadParams = {
            Bucket: this.bucketName,
            Key: key,
            Body: buffer,
            ContentType: this.getContentType(key)
        };

        // Add ACL only if user wants public access
        if (this.makePublic) {
            uploadParams.ACL = 'public-read';
        }

        const command = new PutObjectCommand(uploadParams);
        await this.s3Client.send(command);
        
        // Generate URL based on public access setting
        const region = this.s3Client.config.region || 'us-east-1';
        const url = this.makePublic 
            ? `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`
            : `s3://${this.bucketName}/${key}`;
        
        return url;
    }

    getContentType(filename) {
        const ext = path.extname(filename).toLowerCase();
        const contentTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.bmp': 'image/bmp',
            '.webp': 'image/webp'
        };
        return contentTypes[ext] || 'application/octet-stream';
    }

    async processAllImages() {
        const images = await this.listImages();
        
        if (images.length === 0) {
            console.log(chalk.yellow('⚠️  No images found in the bucket'));
            return;
        }
        
        console.log(chalk.blue(`\n📋 Processing ${images.length} images...\n`));
        
        const allResults = [];
        
        for (let i = 0; i < images.length; i++) {
            const image = images[i];
            const spinner = ora(`Processing ${i + 1}/${images.length}: ${image.Key}`).start();
            
            try {
                // Download image
                const localPath = await this.downloadImage(image.Key);
                
                // Process image into different sizes
                const processedImages = await this.processImage(localPath, image.Key);
                
                // Upload processed images
                const uploadResults = [];
                for (const processed of processedImages) {
                    const url = await this.uploadImage(processed.key, processed.buffer);
                    uploadResults.push({
                        size: processed.size,
                        key: processed.key,
                        url: url
                    });
                }
                
                allResults.push({
                    original: image.Key,
                    processed: uploadResults
                });
                
                spinner.succeed(`✅ Processed ${image.Key} (${processedImages.length} sizes)`);
                
                // Clean up local file
                await fs.unlink(localPath);
                
            } catch (error) {
                spinner.fail(`❌ Failed to process ${image.Key}: ${error.message}`);
            }
        }
        
        return allResults;
    }

    async displayResults(results) {
        console.log(chalk.green.bold('\n🎉 Processing Complete!\n'));
        
        for (const result of results) {
            console.log(chalk.blue.bold(`📸 ${result.original}`));
            for (const processed of result.processed) {
                console.log(chalk.gray(`  ${processed.size}: ${processed.url}`));
            }
            console.log('');
        }
        
        console.log(chalk.green(`✅ Total images processed: ${results.length}`));
        console.log(chalk.green(`✅ Total processed versions: ${results.reduce((sum, r) => sum + r.processed.length, 0)}`));
    }

    async cleanup() {
        try {
            await fs.rmdir(this.tempDir, { recursive: true });
        } catch (error) {
            // Ignore cleanup errors
        }
    }

    async run() {
        try {
            await this.initialize();
            const results = await this.processAllImages();
            
            if (results && results.length > 0) {
                await this.displayResults(results);
            }
            
        } catch (error) {
            console.error(chalk.red.bold('❌ Error:'), error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Check for AWS credentials
if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log(chalk.yellow.bold('⚠️  AWS Credentials Required'));
    console.log(chalk.gray('Please set the following environment variables:'));
    console.log(chalk.gray('  AWS_ACCESS_KEY_ID'));
    console.log(chalk.gray('  AWS_SECRET_ACCESS_KEY'));
    console.log(chalk.gray('  AWS_REGION (optional, defaults to us-east-1)'));
    console.log(chalk.gray('\nYou can also use AWS CLI configuration or IAM roles.'));
    process.exit(1);
}

// Run the application
const processor = new S3ImageProcessor();
processor.run(); 