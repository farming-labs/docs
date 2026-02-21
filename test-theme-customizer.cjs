#!/usr/bin/env node

/**
 * Theme Customizer Test Script
 * Tests theme switching functionality and reports detailed findings
 */

const puppeteer = require('puppeteer');

const evalInitialState = () => {
  const body = document.body;
  const computed = window.getComputedStyle(body);
  const root = getComputedStyle(document.documentElement);
  return {
    bodyBg: computed.backgroundColor,
    fdBg: root.getPropertyValue('--color-fd-background').trim(),
    fdPrimary: root.getPropertyValue('--color-fd-primary').trim(),
    bodyClass: body.className.includes('bg-fd-background') ? 'has bg-fd-background' : 'missing bg-fd-background',
    styleTags: document.querySelectorAll('style').length,
  };
};

const evalAfterPreset = () => {
  const body = document.body;
  const computed = window.getComputedStyle(body);
  const root = getComputedStyle(document.documentElement);
  const styleTags = document.querySelectorAll('style');
  let presetCSSFound = false;
  let colorCSSFound = false;
  styleTags.forEach(s => {
    const html = s.innerHTML;
    if (html.includes('--color-fd-background') && html.includes('!important')) presetCSSFound = true;
    if (html.includes('[data-customizer]')) colorCSSFound = true;
  });
  return {
    bodyBg: computed.backgroundColor,
    fdBg: root.getPropertyValue('--color-fd-background').trim(),
    fdPrimary: root.getPropertyValue('--color-fd-primary').trim(),
    fdCard: root.getPropertyValue('--color-fd-card').trim(),
    presetCSSInjected: presetCSSFound,
    colorCSSInjected: colorCSSFound,
    totalStyleTags: styleTags.length,
  };
};

async function run() {
  console.log('🚀 Starting Theme Customizer Test...\n');
  
  const browser = await puppeteer.launch({ 
    headless: false,
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // 1. Navigate to the docs page
    console.log('📍 Step 1: Navigating to http://localhost:3000/docs');
    await page.goto('http://localhost:3000/docs', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 2. Take initial snapshot
    console.log('📸 Step 2: Taking initial snapshot');
    await page.screenshot({ path: 'screenshot-01-initial.png', fullPage: true });
    console.log('   ✅ Saved: screenshot-01-initial.png');
    
    // 3. Check initial state
    console.log('\n🔍 Step 3: Checking initial state');
    const initialState = await page.evaluate(evalInitialState);
    console.log('   Initial State:');
    console.log('   - Body background:', initialState.bodyBg);
    console.log('   - --color-fd-background:', initialState.fdBg);
    console.log('   - --color-fd-primary:', initialState.fdPrimary);
    console.log('   - Body class check:', initialState.bodyClass);
    console.log('   - Style tags count:', initialState.styleTags);
    
    // 4. Find and click customizer button
    console.log('\n🔘 Step 4: Looking for customizer button');
    
    // Try multiple selectors to find the customizer button
    let customizerButton = null;
    const selectors = [
      'button[title*="Customize"]',
      'button[title*="customize"]',
      '.fixed.z-\\[10010\\]',
      'button.fixed[class*="bottom"]',
    ];
    
    for (const selector of selectors) {
      try {
        customizerButton = await page.$(selector);
        if (customizerButton) {
          console.log(`   ✅ Found customizer button with selector: ${selector}`);
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }
    
    if (!customizerButton) {
      console.log('   ❌ Could not find customizer button with standard selectors');
      console.log('   🔍 Looking for all fixed position buttons...');
      
      // Try to find button by position
      customizerButton = await page.evaluateHandle(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        return buttons.find(btn => {
          const rect = btn.getBoundingClientRect();
          const style = window.getComputedStyle(btn);
          return style.position === 'fixed' && 
                 (btn.title?.toLowerCase().includes('customize') ||
                  (rect.bottom > window.innerHeight - 200 && rect.right > window.innerWidth - 100));
        });
      });
    }
    
    if (customizerButton && customizerButton.asElement()) {
      console.log('   🖱️  Clicking customizer button');
      await customizerButton.asElement().click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    } else {
      throw new Error('Could not find or click customizer button');
    }
    
    // 5. Take snapshot after customizer opens
    console.log('\n📸 Step 5: Taking snapshot after customizer opens');
    await page.screenshot({ path: 'screenshot-02-customizer-open.png', fullPage: true });
    console.log('   ✅ Saved: screenshot-02-customizer-open.png');
    
    // Debug: Check what's in the customizer
    console.log('\n🔍 Debug: Checking customizer content');
    const customizerContent = await page.evaluate(() => {
      const drawer = document.querySelector('[data-customizer]');
      if (!drawer) return 'Customizer drawer not found';
      
      // Get all clickable-looking elements
      const clickables = Array.from(drawer.querySelectorAll('button, div, span')).filter(el => {
        return el.onclick || 
               el.className.includes('cursor') || 
               el.tagName === 'BUTTON' ||
               el.textContent?.trim().length < 50; // Short text likely to be a label
      });
      
      return clickables.slice(0, 30).map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 50),
        classes: el.className.substring(0, 100)
      }));
    });
    console.log('   Clickable elements in customizer:', JSON.stringify(customizerContent, null, 2));
    
    // Check for double TOC issue
    console.log('\n🔍 Checking for TOC issues');
    const tocCheck = await page.evaluate(() => {
      const tocs = document.querySelectorAll('[class*="toc"], [data-toc], nav[class*="toc"]');
      return {
        tocCount: tocs.length,
        tocElements: Array.from(tocs).map(el => ({
          tag: el.tagName,
          classes: el.className,
          position: window.getComputedStyle(el).position,
          visible: window.getComputedStyle(el).display !== 'none'
        }))
      };
    });
    console.log('   TOC elements found:', tocCheck.tocCount);
    console.log('   TOC details:', JSON.stringify(tocCheck.tocElements, null, 2));
    
    // Test each preset
    const presets = ['Default', 'Colorful', 'Darksharp', 'Pixel Border'];
    
    for (let i = 0; i < presets.length; i++) {
      const presetName = presets[i];
      const stepNum = i + 6;
      
      console.log(`\n🎨 Step ${stepNum}: Testing "${presetName}" preset`);
      
      // Look for preset button
      const presetButton = await page.evaluateHandle((name) => {
        // Look for buttons or divs that might be clickable preset options
        const elements = Array.from(document.querySelectorAll('button, div[role="button"], span, div'));
        const found = elements.find(el => {
          const text = el.textContent?.trim();
          const dataLabel = el.getAttribute('data-label');
          // Match exact preset name or check if element contains the preset name
          return text === name || 
                 text?.toLowerCase() === name.toLowerCase() ||
                 dataLabel?.toLowerCase() === name.toLowerCase() ||
                 (el.className.includes('cursor-pointer') && text?.toLowerCase().includes(name.toLowerCase()));
        });
        
        // If still not found, look within customizer drawer
        if (!found) {
          const drawer = document.querySelector('[data-customizer]');
          if (drawer) {
            const drawerElements = Array.from(drawer.querySelectorAll('*'));
            return drawerElements.find(el => {
              const text = el.textContent?.trim();
              return (text === name || text?.toLowerCase() === name.toLowerCase()) &&
                     (el.onclick || el.className.includes('cursor') || el.tagName === 'BUTTON');
            });
          }
        }
        
        return found;
      }, presetName);
      
      if (presetButton && presetButton.asElement()) {
        console.log(`   ✅ Found "${presetName}" button`);
        await presetButton.asElement().click();
        console.log(`   🖱️  Clicked "${presetName}"`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Take screenshot
        const screenshotPath = `screenshot-${stepNum.toString().padStart(2, '0')}-${presetName.toLowerCase().replace(' ', '-')}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: false });
        console.log(`   📸 Saved: ${screenshotPath}`);
        
        // Evaluate state
        const state = await page.evaluate(evalAfterPreset);
        console.log(`   Results for "${presetName}":`);
        console.log('   - Body background:', state.bodyBg);
        console.log('   - --color-fd-background:', state.fdBg);
        console.log('   - --color-fd-primary:', state.fdPrimary);
        console.log('   - --color-fd-card:', state.fdCard);
        console.log('   - Preset CSS injected:', state.presetCSSInjected);
        console.log('   - Color CSS injected:', state.colorCSSInjected);
        console.log('   - Total style tags:', state.totalStyleTags);
      } else {
        console.log(`   ❌ Could not find "${presetName}" button`);
      }
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('\nScreenshots saved:');
    console.log('  - screenshot-01-initial.png');
    console.log('  - screenshot-02-customizer-open.png');
    console.log('  - screenshot-06-default.png');
    console.log('  - screenshot-07-colorful.png');
    console.log('  - screenshot-08-darksharp.png');
    console.log('  - screenshot-09-pixel-border.png');
    
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error(error.stack);
  } finally {
    await browser.close();
  }
}

run().catch(console.error);
