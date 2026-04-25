const fs = require('fs');
const path = require('path');

const rootFiles = ['index.html', 'reviews.html'];
const folders = ['services', 'areas', 'blog'];

const faviconTag = (path) => `  <link rel="icon" type="image/png" href="${path}">\n`;

// Update root files
rootFiles.forEach(file => {
    const filePath = path.join('d:\\painting', file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes('rel="icon"')) {
            content = content.replace('<meta name="theme-color" content="#1C1915">', '<meta name="theme-color" content="#1C1915">\n' + faviconTag('assets/favicon.png'));
            fs.writeFileSync(filePath, content);
            console.log(`Updated favicon in ${file}`);
        }
    }
});

// Update subfolders
folders.forEach(folder => {
    const folderPath = path.join('d:\\painting', folder);
    if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.html'));
        files.forEach(file => {
            const filePath = path.join(folderPath, file);
            let content = fs.readFileSync(filePath, 'utf8');
            if (!content.includes('rel="icon"')) {
                content = content.replace('<meta name="theme-color" content="#1C1915">', '<meta name="theme-color" content="#1C1915">\n' + faviconTag('../assets/favicon.png'));
                fs.writeFileSync(filePath, content);
                console.log(`Updated favicon in ${folder}/${file}`);
            }
        });
    }
});
