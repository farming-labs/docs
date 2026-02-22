#!/usr/bin/env node

/**
 * Detailed sidebar icon and chevron analysis
 */

const puppeteer = require('puppeteer');

async function run() {
  console.log('🔍 Detailed sidebar icon analysis...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    console.log('📍 Navigating to http://localhost:3000/docs');
    await page.goto('http://localhost:3000/docs', { 
      waitUntil: 'networkidle2',
      timeout: 10000 
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('📸 Taking screenshot');
    await page.screenshot({ 
      path: 'sidebar-analysis-final.png', 
      fullPage: true 
    });
    console.log('   ✅ Saved: sidebar-analysis-final.png\n');
    
    console.log('🔍 Running detailed icon analysis...\n');
    
    const linkAnalysis = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const links = sidebar ? sidebar.querySelectorAll('a') : [];
      const results = [];
      for (let i = 0; i < Math.min(links.length, 10); i++) {
        const link = links[i];
        const images = link.querySelectorAll('img, svg');
        const imgDetails = [];
        images.forEach((img, idx) => {
          const style = getComputedStyle(img);
          imgDetails.push({
            index: idx,
            tag: img.tagName,
            display: style.display,
            visibility: style.visibility,
            width: style.width,
            height: style.height,
            isFirstChild: img === link.firstElementChild,
          });
        });
        results.push({
          text: link.textContent?.trim().substring(0, 30),
          href: link.getAttribute('href'),
          totalImages: images.length,
          images: imgDetails,
        });
      }
      return results;
    });
    
    console.log('📊 LINK-BY-LINK ANALYSIS:\n');
    linkAnalysis.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}"`);
      console.log(`   href: ${link.href}`);
      console.log(`   Total icons/images: ${link.totalImages}`);
      if (link.totalImages > 0) {
        link.images.forEach((img) => {
          const visible = img.display !== 'none' && img.visibility !== 'hidden';
          const status = visible ? '👁️  VISIBLE' : '❌ HIDDEN';
          console.log(`   ${status}: ${img.tag} (display: ${img.display}, ${img.width}x${img.height})`);
        });
      } else {
        console.log('   ✅ Text-only, no icons');
      }
      console.log('');
    });
    
    // Check for chevrons in buttons
    console.log('\n🔽 CHEVRON/EXPAND ARROW ANALYSIS:\n');
    const chevronAnalysis = await page.evaluate(() => {
      const sidebar = document.querySelector('aside');
      const buttons = sidebar ? sidebar.querySelectorAll('button, summary') : [];
      const results = [];
      
      buttons.forEach((btn, i) => {
        const text = btn.textContent?.trim();
        if (!text || text.includes('Search') || text.length === 0) return;
        
        const chevrons = btn.querySelectorAll('svg');
        const chevronDetails = [];
        
        chevrons.forEach((svg) => {
          const style = getComputedStyle(svg);
          const classes = svg.getAttribute('class') || '';
          const ariaLabel = svg.getAttribute('aria-label') || '';
          
          chevronDetails.push({
            display: style.display,
            visibility: style.visibility,
            width: style.width,
            height: style.height,
            classes: classes,
            ariaLabel: ariaLabel,
            transform: style.transform
          });
        });
        
        results.push({
          text: text.substring(0, 40),
          tag: btn.tagName,
          hasChevrons: chevrons.length > 0,
          chevronCount: chevrons.length,
          chevrons: chevronDetails
        });
      });
      
      return results;
    });
    
    if (chevronAnalysis.length > 0) {
      chevronAnalysis.forEach((item, i) => {
        console.log(`${i + 1}. "${item.text}" (${item.tag})`);
        console.log(`   Chevrons found: ${item.chevronCount}`);
        if (item.chevronCount > 0) {
          item.chevrons.forEach((chev, idx) => {
            const visible = chev.display !== 'none' && chev.visibility !== 'hidden';
            const status = visible ? '👁️  VISIBLE' : '❌ HIDDEN';
            console.log(`   ${status}: SVG ${idx + 1} (display: ${chev.display}, ${chev.width}x${chev.height})`);
            if (chev.classes) console.log(`      classes: ${chev.classes}`);
          });
        }
        console.log('');
      });
    } else {
      console.log('⚠️  No expandable items with chevrons found\n');
    }
    
    // Summary
    console.log('\n📋 SUMMARY:\n');
    
    const hiddenLinks = linkAnalysis.filter(l => 
      l.totalImages > 0 && l.images.every(img => img.display === 'none')
    );
    const visibleIconLinks = linkAnalysis.filter(l => 
      l.totalImages > 0 && l.images.some(img => img.display !== 'none')
    );
    const textOnlyLinks = linkAnalysis.filter(l => l.totalImages === 0);
    
    console.log(`✅ Text-only links: ${textOnlyLinks.length}`);
    console.log(`👁️  Links with visible icons: ${visibleIconLinks.length}`);
    console.log(`❌ Links with hidden icons: ${hiddenLinks.length}`);
    
    if (visibleIconLinks.length > 0) {
      console.log('\n   Links with VISIBLE icons:');
      visibleIconLinks.forEach(l => console.log(`   - ${l.text}`));
    }
    
    const visibleChevrons = chevronAnalysis.filter(c => 
      c.chevronCount > 0 && c.chevrons.some(ch => ch.display !== 'none')
    );
    const hiddenChevrons = chevronAnalysis.filter(c => 
      c.chevronCount > 0 && c.chevrons.every(ch => ch.display === 'none')
    );
    
    console.log(`\n🔽 Expandable items with visible chevrons: ${visibleChevrons.length}`);
    console.log(`❌ Expandable items with hidden chevrons: ${hiddenChevrons.length}`);
    
    if (hiddenChevrons.length > 0) {
      console.log('\n   Items missing chevrons:');
      hiddenChevrons.forEach(c => console.log(`   - ${c.text}`));
    }
    
    console.log('\n✅ Analysis complete!');
    console.log('📸 Screenshot: sidebar-analysis-final.png');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
