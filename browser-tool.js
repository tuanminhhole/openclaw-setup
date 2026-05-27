/**
 * browser-tool.js v2 — Full-featured Chrome CDP controller
 * Connects to real Chrome via CDP (socat bridge in Docker → host Chrome)
 * 
 * Commands:
 *   status                    — Check connection + current page
 *   open <url>                — Navigate to URL
 *   get_url                   — Get current page URL
 *   get_text [maxLen]         — Get page text content (default 4000 chars)
 *   get_links [filter]        — Get all links, optional filter keyword
 *   get_posts                 — Extract Facebook group posts with permalinks
 *   screenshot [path]         — Take screenshot (saves to path or prints base64)
 *   evaluate <js_code>        — Run arbitrary JavaScript on page
 *   scroll [pixels]           — Scroll down (default 800px)
 *   click <selector>          — Click first matching element
 *   fill <selector> <text>    — Fill input with text
 *   press <key>               — Press keyboard key
 *   hover <selector>          — Hover over element
 *   select <selector> <value> — Select option in dropdown
 *   tabs                      — List all open tabs
 *   new_tab [url]             — Open new tab (default about:blank)
 *   switch_tab <index>        — Switch to tab by index (0-based)
 *   close_tab [index]         — Close tab by index (default: current)
 *   pdf [path]                — Export page as PDF
 *   console                   — Get recent console messages
 *   resize <width> <height>   — Resize viewport
 *   wait <ms>                 — Wait for specified milliseconds
 *   upload <selector> <path>  — Upload file to file input
 */
const { chromium } = require('/usr/local/lib/node_modules/openclaw/node_modules/playwright-core');
const fs = require('fs');
const path = require('path');

const action = process.argv[2];
const param1 = process.argv[3];
const param2 = process.argv[4];
const CDP_URL = 'http://127.0.0.1:9222';

(async () => {
    let browser;
    try {
        browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
        const ctx = browser.contexts()[0];
        const pages = ctx.pages();
        let page = pages.length > 0 ? pages[0] : await ctx.newPage();

        // ═══════════════════════════════════════
        // NAVIGATION & INFO
        // ═══════════════════════════════════════
        if (action === 'open') {
            console.log('[Browser] Opening: ' + param1);
            await page.goto(param1, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForTimeout(1500);
            console.log('[Browser] Opened: ' + (await page.title()) + ' | ' + page.url());

        } else if (action === 'get_url') {
            console.log(page.url());

        } else if (action === 'status') {
            const allPages = ctx.pages();
            console.log('[Browser] Connected! Tabs: ' + allPages.length);
            console.log('[Browser] Current: ' + (await page.title()) + ' | ' + page.url());

        // ═══════════════════════════════════════
        // CONTENT EXTRACTION
        // ═══════════════════════════════════════
        } else if (action === 'get_text') {
            const maxLen = parseInt(param1) || 4000;
            const text = await page.evaluate(() => {
                document.querySelectorAll('script,style,noscript,svg').forEach(e => e.remove());
                return document.body.innerText.trim();
            });
            console.log(text.substring(0, maxLen));

        } else if (action === 'get_links') {
            const filterPattern = param1 || '';
            const links = await page.evaluate((filter) => {
                const anchors = Array.from(document.querySelectorAll('a[href]'));
                const results = anchors.map(a => a.href).filter(href => href && href.startsWith('http'));
                if (filter) return [...new Set(results.filter(h => h.includes(filter)))];
                return [...new Set(results)];
            }, filterPattern);
            console.log(JSON.stringify(links.slice(0, 50), null, 2));

        } else if (action === 'get_posts') {
            // Extract Facebook group/fanpage posts with permalinks
            const posts = await page.evaluate(() => {
                const results = [];
                // Groups use role="article", Fanpages might use data-ad-comet-preview="message" parent divs
                let articles = Array.from(document.querySelectorAll('[role="article"]'));
                if (articles.length < 3) {
                   const altNodes = Array.from(document.querySelectorAll('div[data-ad-preview="message"], div[data-ad-comet-preview="message"]'));
                   altNodes.forEach(node => {
                      // Find the closest wrapper that resembles a post box
                      let parent = node.closest('div[class*="x1yztbdb"], div[class*="x1lliihq"]');
                      if (!parent) parent = node.parentElement.parentElement.parentElement;
                      if (parent && !articles.includes(parent)) articles.push(parent);
                   });
                }
                
                for (const article of articles) {
                    const textEl = article.querySelector('[data-ad-comet-preview="message"], [data-ad-preview="message"], div[dir="auto"][style*="text-align"]');
                    let text = textEl ? textEl.innerText.trim() : '';
                    let fullText = text || article.innerText.substring(0, 800);
                    
                    // Clean up Facebook UI garbage from innerText fallback
                    fullText = fullText.replace(/Ẩn bớt/g, '')
                                       .replace(/Xem thêm/g, '')
                                       .replace(/^Thích$/gm, '')
                                       .replace(/^Bình luận(?: dưới tên.*)?$/gm, '')
                                       .replace(/^Chia sẻ$/gm, '')
                                       .replace(/^Gửi$/gm, '')
                                       .replace(/^\d+ (giờ|phút|ngày|tuần|tháng|năm)( trước)?$/gm, '')
                                       .replace(/^\+?\d+[KkMm]?$/gm, '')
                                       .replace(/^·$/gm, '')
                                       .replace(/\n{3,}/g, '\n\n')
                                       .trim();
                    
                    // Permalink
                    const allLinks = Array.from(article.querySelectorAll('a[href]'));
                    let permalink = '';
                    for (const a of allLinks) {
                        const href = a.href || '';
                        if (href.includes('/posts/') || href.includes('/permalink/') || href.includes('story_fbid') || href.includes('/photos/') || href.includes('/videos/') || href.includes('/reel/')) {
                            permalink = href.split('?')[0];
                            // Clean up trailing slash
                            if (permalink.endsWith('/')) permalink = permalink.slice(0, -1);
                            break;
                        }
                    }
                    // Fallback permalink generator if not found to avoid 'N/A' collision
                    if (!permalink) {
                       permalink = 'post_' + Math.random().toString(36).substring(2, 10);
                    }
                    
                    // Author
                    let author = '';
                    const headLinks = article.querySelectorAll('a[role="link"] strong, h2 a, h3 a, h4 a, strong');
                    for (const el of headLinks) {
                        const name = el.innerText.trim();
                        if (name && name.length > 1 && name.length < 50) { author = name; break; }
                    }
                    
                    // Time posted
                    let timePosted = '';
                    const timeLinks = allLinks.filter(a => {
                        const href = a.href || '';
                        return href.includes('/posts/') || href.includes('/permalink/') || href.includes('/photos/') || href.includes('/videos/') || href.includes('/reel/');
                    });
                    if (timeLinks.length > 0) {
                        const timeText = timeLinks[0].innerText.trim();
                        if (timeText && timeText.length < 30 && !timeText.includes('Like') && !timeText.includes('Share')) timePosted = timeText;
                    }
                    if (!timePosted) {
                        const timeEl = article.querySelector('abbr, [data-utime], span[id*="jsc"]');
                        if (timeEl) timePosted = timeEl.innerText.trim() || timeEl.getAttribute('title') || '';
                    }

                    // Images
                    const imgNodes = article.querySelectorAll('img');
                    const imgUrls = [];
                    for (const img of imgNodes) {
                        const src = img.src || '';
                        // Ignore avatars, tiny icons, and Facebook UI static resources
                        if (src.startsWith('http') && !src.includes('emoji') && !src.includes('/p40x40/') && !src.includes('/p36x36/') && !src.includes('static.xx.fbcdn.net') && !src.includes('rsrc.php') && !src.includes('/p16x16/')) {
                           imgUrls.push(src);
                        }
                    }
                    
                    if (fullText.length > 10) { // Reduced to 10 for short picture posts
                        results.push({
                            author: author || 'N/A',
                            text: fullText.substring(0, 500),
                            permalink: permalink,
                            time: timePosted || 'N/A',
                            images: imgUrls
                        });
                    }
                }
                return results;
            });
            if (posts.length === 0) {
                console.log('[Browser] No posts found. Try scroll then get_posts again.');
            } else {
                console.log(JSON.stringify(posts.slice(0, 10), null, 2));
            }

        } else if (action === 'evaluate') {
            // Run arbitrary JavaScript on page
            const code = process.argv.slice(3).join(' ');
            if (!code) { console.log('[Browser] Usage: evaluate <js_code>'); process.exit(1); }
            const result = await page.evaluate(code);
            if (result !== undefined && result !== null) {
                console.log(typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result));
            } else {
                console.log('[Browser] Evaluate done (no return value)');
            }

        } else if (action === 'console') {
            // Capture console messages for 2 seconds
            const messages = [];
            page.on('console', msg => messages.push(`[${msg.type()}] ${msg.text()}`));
            await page.waitForTimeout(2000);
            if (messages.length === 0) {
                console.log('[Browser] No console messages captured in 2s');
            } else {
                console.log(messages.join('\n'));
            }

        // ═══════════════════════════════════════
        // SCREENSHOTS & EXPORT
        // ═══════════════════════════════════════
        } else if (action === 'screenshot') {
            const savePath = param1 || '/tmp/screenshot.png';
            await page.screenshot({ path: savePath, fullPage: false });
            console.log('[Browser] Screenshot saved: ' + savePath);

        } else if (action === 'screenshot_full') {
            const savePath = param1 || '/tmp/screenshot_full.png';
            await page.screenshot({ path: savePath, fullPage: true });
            console.log('[Browser] Full-page screenshot saved: ' + savePath);

        } else if (action === 'pdf') {
            const savePath = param1 || '/tmp/page.pdf';
            await page.pdf({ path: savePath, format: 'A4' });
            console.log('[Browser] PDF saved: ' + savePath);

        // ═══════════════════════════════════════
        // INTERACTIONS
        // ═══════════════════════════════════════
        } else if (action === 'click') {
            await page.locator(param1).first().click({ timeout: 5000 });
            await page.waitForTimeout(600);
            console.log('[Browser] Clicked: ' + param1);

        } else if (action === 'fill') {
            await page.locator(param1).first().fill(param2, { timeout: 5000 });
            console.log('[Browser] Filled "' + param2 + '" into: ' + param1);

        } else if (action === 'press') {
            await page.keyboard.press(param1);
            await page.waitForTimeout(1000);
            console.log('[Browser] Pressed: ' + param1);

        } else if (action === 'hover') {
            await page.locator(param1).first().hover({ timeout: 5000 });
            console.log('[Browser] Hovered: ' + param1);

        } else if (action === 'select') {
            await page.locator(param1).first().selectOption(param2, { timeout: 5000 });
            console.log('[Browser] Selected "' + param2 + '" in: ' + param1);

        } else if (action === 'upload') {
            await page.locator(param1).first().setInputFiles(param2, { timeout: 5000 });
            console.log('[Browser] Uploaded "' + param2 + '" to: ' + param1);

        } else if (action === 'scroll') {
            const amount = parseInt(param1) || 800;
            await page.evaluate((px) => window.scrollBy(0, px), amount);
            await page.waitForTimeout(2000);
            console.log('[Browser] Scrolled down ' + amount + 'px');

        } else if (action === 'wait') {
            const ms = parseInt(param1) || 1000;
            await page.waitForTimeout(ms);
            console.log('[Browser] Waited ' + ms + 'ms');

        } else if (action === 'resize') {
            const width = parseInt(param1) || 1280;
            const height = parseInt(param2) || 720;
            await page.setViewportSize({ width, height });
            console.log('[Browser] Resized to ' + width + 'x' + height);

        // ═══════════════════════════════════════
        // TAB MANAGEMENT
        // ═══════════════════════════════════════
        } else if (action === 'tabs') {
            const allPages = ctx.pages();
            for (let i = 0; i < allPages.length; i++) {
                const title = await allPages[i].title().catch(() => '(untitled)');
                const url = allPages[i].url();
                const marker = allPages[i] === page ? ' ◀ current' : '';
                console.log(`[${i}] ${title} | ${url}${marker}`);
            }

        } else if (action === 'new_tab') {
            const newPage = await ctx.newPage();
            if (param1) {
                await newPage.goto(param1, { waitUntil: 'domcontentloaded', timeout: 30000 });
            }
            const allPages = ctx.pages();
            console.log('[Browser] New tab opened (#' + (allPages.length - 1) + ')' + (param1 ? ' → ' + param1 : ''));

        } else if (action === 'switch_tab') {
            const idx = parseInt(param1);
            const allPages = ctx.pages();
            if (isNaN(idx) || idx < 0 || idx >= allPages.length) {
                console.log('[Browser] Invalid tab index. Use "tabs" to see available tabs (0-' + (allPages.length - 1) + ')');
            } else {
                page = allPages[idx];
                await page.bringToFront();
                console.log('[Browser] Switched to tab [' + idx + ']: ' + (await page.title()) + ' | ' + page.url());
            }

        } else if (action === 'close_tab') {
            const allPages = ctx.pages();
            const idx = param1 !== undefined ? parseInt(param1) : allPages.indexOf(page);
            if (isNaN(idx) || idx < 0 || idx >= allPages.length) {
                console.log('[Browser] Invalid tab index.');
            } else if (allPages.length <= 1) {
                console.log('[Browser] Cannot close last tab.');
            } else {
                await allPages[idx].close();
                console.log('[Browser] Closed tab [' + idx + ']. Remaining: ' + (allPages.length - 1) + ' tabs');
            }

        // ═══════════════════════════════════════
        // HELP
        // ═══════════════════════════════════════
        } else {
            console.log('browser-tool.js v2 — Commands:');
            console.log('  Navigation:  open <url> | get_url | status');
            console.log('  Content:     get_text [maxLen] | get_links [filter] | get_posts | evaluate <js> | console');
            console.log('  Screenshot:  screenshot [path] | screenshot_full [path] | pdf [path]');
            console.log('  Interact:    click <sel> | fill <sel> <text> | press <key> | hover <sel> | select <sel> <val> | upload <sel> <path>');
            console.log('  Scroll:      scroll [px] | wait <ms> | resize <w> <h>');
            console.log('  Tabs:        tabs | new_tab [url] | switch_tab <idx> | close_tab [idx]');
        }
    } catch(e) {
        if (e.message.includes('ECONNREFUSED') || e.message.includes('Timeout')) {
            console.error('[Browser] Chrome Debug not running! Start Chrome with --remote-debugging-port=9222');
        } else {
            console.error('[Browser] Error:', e.message);
        }
    } finally {
        if (browser) await browser.close();
    }
})();
