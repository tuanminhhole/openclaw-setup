# Navigation
node ~/browser-tool.js status
node ~/browser-tool.js open "https://google.com"
node ~/browser-tool.js get_url

# ⭐ Content extraction — LUÔN dùng get_posts cho Facebook
node ~/browser-tool.js get_posts
node ~/browser-tool.js get_text
node ~/browser-tool.js get_text 8000
node ~/browser-tool.js get_links
node ~/browser-tool.js get_links "/posts/"
node ~/browser-tool.js evaluate "document.title"
node ~/browser-tool.js console

# Screenshots & export
node ~/browser-tool.js screenshot
node ~/browser-tool.js screenshot_full
node ~/browser-tool.js pdf

# Interactions
node ~/browser-tool.js click "button.submit"
node ~/browser-tool.js fill "input[name='q']" "search"
node ~/browser-tool.js press "Enter"
node ~/browser-tool.js hover "a.link"
node ~/browser-tool.js select "select#id" "value"
node ~/browser-tool.js upload "input[type=file]" "/tmp/photo.jpg"

# Scrolling & viewport
node ~/browser-tool.js scroll
node ~/browser-tool.js scroll 1500
node ~/browser-tool.js wait 3000
node ~/browser-tool.js resize 1920 1080

# Tab management
node ~/browser-tool.js tabs
node ~/browser-tool.js new_tab "https://example.com"
node ~/browser-tool.js switch_tab 1
node ~/browser-tool.js close_tab 2
