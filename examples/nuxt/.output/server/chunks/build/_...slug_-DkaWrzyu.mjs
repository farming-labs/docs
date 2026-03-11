import { defineComponent, computed, withAsyncContext, unref, mergeProps, withCtx, createVNode, toValue, reactive, watch, ref, createTextVNode, toDisplayString, openBlock, createBlock, createCommentVNode, Fragment, renderList, withModifiers, getCurrentInstance, onServerPrefetch, nextTick, resolveDynamicComponent, shallowRef, toRef, createElementBlock, provide, cloneVNode, h, useSSRContext } from 'vue';
import { ssrRenderAttrs, ssrRenderComponent, ssrInterpolate, ssrRenderClass, ssrRenderSlot, ssrRenderList, ssrRenderAttr, ssrIncludeBooleanAttr, ssrRenderTeleport, ssrRenderStyle, ssrRenderVNode } from 'vue/server-renderer';
import { _ as __nuxt_component_0 } from './nuxt-link-D7c_p4UB.mjs';
import { d as useRoute$1, c as createError, f as fetchDefaults, b as useRoute, _ as _export_sfc, u as useNuxtApp, a as asyncDataDefaults } from './server.mjs';
import { u as useHead } from './v3-1LtHzpL3.mjs';
import { highlight } from 'sugar-high';
import { defineDocs, createTheme } from '@farming-labs/docs';
import { v as hash } from '../nitro/nitro.mjs';
import '../routes/renderer.mjs';
import 'vue-bundle-renderer/runtime';
import 'unhead/server';
import 'devalue';
import 'unhead/utils';
import 'unhead/plugins';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:fs';
import 'node:path';
import 'node:crypto';
import 'node:url';

//#region src/index.ts
const DEBOUNCE_DEFAULTS = { trailing: true };
/**
Debounce functions
@param fn - Promise-returning/async function to debounce.
@param wait - Milliseconds to wait before calling `fn`. Default value is 25ms
@returns A function that delays calling `fn` until after `wait` milliseconds have elapsed since the last time it was called.
@example
```
import { debounce } from 'perfect-debounce';
const expensiveCall = async input => input;
const debouncedFn = debounce(expensiveCall, 200);
for (const number of [1, 2, 3]) {
console.log(await debouncedFn(number));
}
//=> 1
//=> 2
//=> 3
```
*/
function debounce(fn, wait = 25, options = {}) {
	options = {
		...DEBOUNCE_DEFAULTS,
		...options
	};
	if (!Number.isFinite(wait)) throw new TypeError("Expected `wait` to be a finite number");
	let leadingValue;
	let timeout;
	let resolveList = [];
	let currentPromise;
	let trailingArgs;
	const applyFn = (_this, args) => {
		currentPromise = _applyPromised(fn, _this, args);
		currentPromise.finally(() => {
			currentPromise = null;
			if (options.trailing && trailingArgs && !timeout) {
				const promise = applyFn(_this, trailingArgs);
				trailingArgs = null;
				return promise;
			}
		});
		return currentPromise;
	};
	const debounced = function(...args) {
		if (options.trailing) trailingArgs = args;
		if (currentPromise) return currentPromise;
		return new Promise((resolve) => {
			const shouldCallNow = !timeout && options.leading;
			clearTimeout(timeout);
			timeout = setTimeout(() => {
				timeout = null;
				const promise = options.leading ? leadingValue : applyFn(this, args);
				trailingArgs = null;
				for (const _resolve of resolveList) _resolve(promise);
				resolveList = [];
			}, wait);
			if (shouldCallNow) {
				leadingValue = applyFn(this, args);
				resolve(leadingValue);
			} else resolveList.push(resolve);
		});
	};
	const _clearTimeout = (timer) => {
		if (timer) {
			clearTimeout(timer);
			timeout = null;
		}
	};
	debounced.isPending = () => !!timeout;
	debounced.cancel = () => {
		_clearTimeout(timeout);
		resolveList = [];
		trailingArgs = null;
	};
	debounced.flush = () => {
		_clearTimeout(timeout);
		if (!trailingArgs || currentPromise) return;
		const args = trailingArgs;
		trailingArgs = null;
		return applyFn(this, args);
	};
	return debounced;
}
async function _applyPromised(fn, _this, args) {
	return await fn.apply(_this, args);
}

var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
var shared_cjs_prod = {};
var hasRequiredShared_cjs_prod;
function requireShared_cjs_prod() {
  if (hasRequiredShared_cjs_prod) return shared_cjs_prod;
  hasRequiredShared_cjs_prod = 1;
  Object.defineProperty(shared_cjs_prod, "__esModule", { value: true });
  // @__NO_SIDE_EFFECTS__
  function makeMap(str) {
    const map = /* @__PURE__ */ Object.create(null);
    for (const key of str.split(",")) map[key] = 1;
    return (val) => val in map;
  }
  const EMPTY_OBJ = {};
  const EMPTY_ARR = [];
  const NOOP = () => {
  };
  const NO = () => false;
  const isOn = (key) => key.charCodeAt(0) === 111 && key.charCodeAt(1) === 110 && // uppercase letter
  (key.charCodeAt(2) > 122 || key.charCodeAt(2) < 97);
  const isModelListener = (key) => key.startsWith("onUpdate:");
  const extend = Object.assign;
  const remove = (arr, el) => {
    const i = arr.indexOf(el);
    if (i > -1) {
      arr.splice(i, 1);
    }
  };
  const hasOwnProperty = Object.prototype.hasOwnProperty;
  const hasOwn = (val, key) => hasOwnProperty.call(val, key);
  const isArray = Array.isArray;
  const isMap = (val) => toTypeString(val) === "[object Map]";
  const isSet = (val) => toTypeString(val) === "[object Set]";
  const isDate = (val) => toTypeString(val) === "[object Date]";
  const isRegExp = (val) => toTypeString(val) === "[object RegExp]";
  const isFunction = (val) => typeof val === "function";
  const isString = (val) => typeof val === "string";
  const isSymbol = (val) => typeof val === "symbol";
  const isObject = (val) => val !== null && typeof val === "object";
  const isPromise = (val) => {
    return (isObject(val) || isFunction(val)) && isFunction(val.then) && isFunction(val.catch);
  };
  const objectToString = Object.prototype.toString;
  const toTypeString = (value) => objectToString.call(value);
  const toRawType = (value) => {
    return toTypeString(value).slice(8, -1);
  };
  const isPlainObject = (val) => toTypeString(val) === "[object Object]";
  const isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
  const isReservedProp = /* @__PURE__ */ makeMap(
    // the leading comma is intentional so empty string "" is also included
    ",key,ref,ref_for,ref_key,onVnodeBeforeMount,onVnodeMounted,onVnodeBeforeUpdate,onVnodeUpdated,onVnodeBeforeUnmount,onVnodeUnmounted"
  );
  const isBuiltInDirective = /* @__PURE__ */ makeMap(
    "bind,cloak,else-if,else,for,html,if,model,on,once,pre,show,slot,text,memo"
  );
  const cacheStringFunction = (fn) => {
    const cache = /* @__PURE__ */ Object.create(null);
    return ((str) => {
      const hit = cache[str];
      return hit || (cache[str] = fn(str));
    });
  };
  const camelizeRE = /-\w/g;
  const camelize = cacheStringFunction(
    (str) => {
      return str.replace(camelizeRE, (c) => c.slice(1).toUpperCase());
    }
  );
  const hyphenateRE = /\B([A-Z])/g;
  const hyphenate = cacheStringFunction(
    (str) => str.replace(hyphenateRE, "-$1").toLowerCase()
  );
  const capitalize = cacheStringFunction((str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  const toHandlerKey = cacheStringFunction(
    (str) => {
      const s = str ? `on${capitalize(str)}` : ``;
      return s;
    }
  );
  const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
  const invokeArrayFns = (fns, ...arg) => {
    for (let i = 0; i < fns.length; i++) {
      fns[i](...arg);
    }
  };
  const def = (obj, key, value, writable = false) => {
    Object.defineProperty(obj, key, {
      configurable: true,
      enumerable: false,
      writable,
      value
    });
  };
  const looseToNumber = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? val : n;
  };
  const toNumber = (val) => {
    const n = isString(val) ? Number(val) : NaN;
    return isNaN(n) ? val : n;
  };
  let _globalThis;
  const getGlobalThis = () => {
    return _globalThis || (_globalThis = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof commonjsGlobal !== "undefined" ? commonjsGlobal : {});
  };
  const identRE = /^[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/;
  function genPropsAccessExp(name) {
    return identRE.test(name) ? `__props.${name}` : `__props[${JSON.stringify(name)}]`;
  }
  function genCacheKey(source, options) {
    return source + JSON.stringify(
      options,
      (_, val) => typeof val === "function" ? val.toString() : val
    );
  }
  const PatchFlags = {
    "TEXT": 1,
    "1": "TEXT",
    "CLASS": 2,
    "2": "CLASS",
    "STYLE": 4,
    "4": "STYLE",
    "PROPS": 8,
    "8": "PROPS",
    "FULL_PROPS": 16,
    "16": "FULL_PROPS",
    "NEED_HYDRATION": 32,
    "32": "NEED_HYDRATION",
    "STABLE_FRAGMENT": 64,
    "64": "STABLE_FRAGMENT",
    "KEYED_FRAGMENT": 128,
    "128": "KEYED_FRAGMENT",
    "UNKEYED_FRAGMENT": 256,
    "256": "UNKEYED_FRAGMENT",
    "NEED_PATCH": 512,
    "512": "NEED_PATCH",
    "DYNAMIC_SLOTS": 1024,
    "1024": "DYNAMIC_SLOTS",
    "DEV_ROOT_FRAGMENT": 2048,
    "2048": "DEV_ROOT_FRAGMENT",
    "CACHED": -1,
    "-1": "CACHED",
    "BAIL": -2,
    "-2": "BAIL"
  };
  const PatchFlagNames = {
    [1]: `TEXT`,
    [2]: `CLASS`,
    [4]: `STYLE`,
    [8]: `PROPS`,
    [16]: `FULL_PROPS`,
    [32]: `NEED_HYDRATION`,
    [64]: `STABLE_FRAGMENT`,
    [128]: `KEYED_FRAGMENT`,
    [256]: `UNKEYED_FRAGMENT`,
    [512]: `NEED_PATCH`,
    [1024]: `DYNAMIC_SLOTS`,
    [2048]: `DEV_ROOT_FRAGMENT`,
    [-1]: `CACHED`,
    [-2]: `BAIL`
  };
  const ShapeFlags = {
    "ELEMENT": 1,
    "1": "ELEMENT",
    "FUNCTIONAL_COMPONENT": 2,
    "2": "FUNCTIONAL_COMPONENT",
    "STATEFUL_COMPONENT": 4,
    "4": "STATEFUL_COMPONENT",
    "TEXT_CHILDREN": 8,
    "8": "TEXT_CHILDREN",
    "ARRAY_CHILDREN": 16,
    "16": "ARRAY_CHILDREN",
    "SLOTS_CHILDREN": 32,
    "32": "SLOTS_CHILDREN",
    "TELEPORT": 64,
    "64": "TELEPORT",
    "SUSPENSE": 128,
    "128": "SUSPENSE",
    "COMPONENT_SHOULD_KEEP_ALIVE": 256,
    "256": "COMPONENT_SHOULD_KEEP_ALIVE",
    "COMPONENT_KEPT_ALIVE": 512,
    "512": "COMPONENT_KEPT_ALIVE",
    "COMPONENT": 6,
    "6": "COMPONENT"
  };
  const SlotFlags = {
    "STABLE": 1,
    "1": "STABLE",
    "DYNAMIC": 2,
    "2": "DYNAMIC",
    "FORWARDED": 3,
    "3": "FORWARDED"
  };
  const slotFlagsText = {
    [1]: "STABLE",
    [2]: "DYNAMIC",
    [3]: "FORWARDED"
  };
  const GLOBALS_ALLOWED = "Infinity,undefined,NaN,isFinite,isNaN,parseFloat,parseInt,decodeURI,decodeURIComponent,encodeURI,encodeURIComponent,Math,Number,Date,Array,Object,Boolean,String,RegExp,Map,Set,JSON,Intl,BigInt,console,Error,Symbol";
  const isGloballyAllowed = /* @__PURE__ */ makeMap(GLOBALS_ALLOWED);
  const isGloballyWhitelisted = isGloballyAllowed;
  const range = 2;
  function generateCodeFrame(source, start = 0, end = source.length) {
    start = Math.max(0, Math.min(start, source.length));
    end = Math.max(0, Math.min(end, source.length));
    if (start > end) return "";
    let lines = source.split(/(\r?\n)/);
    const newlineSequences = lines.filter((_, idx) => idx % 2 === 1);
    lines = lines.filter((_, idx) => idx % 2 === 0);
    let count = 0;
    const res = [];
    for (let i = 0; i < lines.length; i++) {
      count += lines[i].length + (newlineSequences[i] && newlineSequences[i].length || 0);
      if (count >= start) {
        for (let j = i - range; j <= i + range || end > count; j++) {
          if (j < 0 || j >= lines.length) continue;
          const line = j + 1;
          res.push(
            `${line}${" ".repeat(Math.max(3 - String(line).length, 0))}|  ${lines[j]}`
          );
          const lineLength = lines[j].length;
          const newLineSeqLength = newlineSequences[j] && newlineSequences[j].length || 0;
          if (j === i) {
            const pad = start - (count - (lineLength + newLineSeqLength));
            const length = Math.max(
              1,
              end > count ? lineLength - pad : end - start
            );
            res.push(`   |  ` + " ".repeat(pad) + "^".repeat(length));
          } else if (j > i) {
            if (end > count) {
              const length = Math.max(Math.min(end - count, lineLength), 1);
              res.push(`   |  ` + "^".repeat(length));
            }
            count += lineLength + newLineSeqLength;
          }
        }
        break;
      }
    }
    return res.join("\n");
  }
  function normalizeStyle(value) {
    if (isArray(value)) {
      const res = {};
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        const normalized = isString(item) ? parseStringStyle(item) : normalizeStyle(item);
        if (normalized) {
          for (const key in normalized) {
            res[key] = normalized[key];
          }
        }
      }
      return res;
    } else if (isString(value) || isObject(value)) {
      return value;
    }
  }
  const listDelimiterRE = /;(?![^(]*\))/g;
  const propertyDelimiterRE = /:([^]+)/;
  const styleCommentRE = /\/\*[^]*?\*\//g;
  function parseStringStyle(cssText) {
    const ret = {};
    cssText.replace(styleCommentRE, "").split(listDelimiterRE).forEach((item) => {
      if (item) {
        const tmp = item.split(propertyDelimiterRE);
        tmp.length > 1 && (ret[tmp[0].trim()] = tmp[1].trim());
      }
    });
    return ret;
  }
  function stringifyStyle(styles) {
    if (!styles) return "";
    if (isString(styles)) return styles;
    let ret = "";
    for (const key in styles) {
      const value = styles[key];
      if (isString(value) || typeof value === "number") {
        const normalizedKey = key.startsWith(`--`) ? key : hyphenate(key);
        ret += `${normalizedKey}:${value};`;
      }
    }
    return ret;
  }
  function normalizeClass(value) {
    let res = "";
    if (isString(value)) {
      res = value;
    } else if (isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const normalized = normalizeClass(value[i]);
        if (normalized) {
          res += normalized + " ";
        }
      }
    } else if (isObject(value)) {
      for (const name in value) {
        if (value[name]) {
          res += name + " ";
        }
      }
    }
    return res.trim();
  }
  function normalizeProps(props) {
    if (!props) return null;
    let { class: klass, style } = props;
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass);
    }
    if (style) {
      props.style = normalizeStyle(style);
    }
    return props;
  }
  const HTML_TAGS = "html,body,base,head,link,meta,style,title,address,article,aside,footer,header,hgroup,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption,figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code,data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup,time,u,var,wbr,area,audio,map,track,video,embed,object,param,source,canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td,th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup,option,output,progress,select,textarea,details,dialog,menu,summary,template,blockquote,iframe,tfoot";
  const SVG_TAGS = "svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile,defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask,mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol,text,textPath,title,tspan,unknown,use,view";
  const MATH_TAGS = "annotation,annotation-xml,maction,maligngroup,malignmark,math,menclose,merror,mfenced,mfrac,mfraction,mglyph,mi,mlabeledtr,mlongdiv,mmultiscripts,mn,mo,mover,mpadded,mphantom,mprescripts,mroot,mrow,ms,mscarries,mscarry,msgroup,msline,mspace,msqrt,msrow,mstack,mstyle,msub,msubsup,msup,mtable,mtd,mtext,mtr,munder,munderover,none,semantics";
  const VOID_TAGS = "area,base,br,col,embed,hr,img,input,link,meta,param,source,track,wbr";
  const isHTMLTag = /* @__PURE__ */ makeMap(HTML_TAGS);
  const isSVGTag = /* @__PURE__ */ makeMap(SVG_TAGS);
  const isMathMLTag = /* @__PURE__ */ makeMap(MATH_TAGS);
  const isVoidTag = /* @__PURE__ */ makeMap(VOID_TAGS);
  const specialBooleanAttrs = `itemscope,allowfullscreen,formnovalidate,ismap,nomodule,novalidate,readonly`;
  const isSpecialBooleanAttr = /* @__PURE__ */ makeMap(specialBooleanAttrs);
  const isBooleanAttr = /* @__PURE__ */ makeMap(
    specialBooleanAttrs + `,async,autofocus,autoplay,controls,default,defer,disabled,hidden,inert,loop,open,required,reversed,scoped,seamless,checked,muted,multiple,selected`
  );
  function includeBooleanAttr(value) {
    return !!value || value === "";
  }
  const unsafeAttrCharRE = /[>/="'\u0009\u000a\u000c\u0020]/;
  const attrValidationCache = {};
  function isSSRSafeAttrName(name) {
    if (attrValidationCache.hasOwnProperty(name)) {
      return attrValidationCache[name];
    }
    const isUnsafe = unsafeAttrCharRE.test(name);
    if (isUnsafe) {
      console.error(`unsafe attribute name: ${name}`);
    }
    return attrValidationCache[name] = !isUnsafe;
  }
  const propsToAttrMap = {
    acceptCharset: "accept-charset",
    className: "class",
    htmlFor: "for",
    httpEquiv: "http-equiv"
  };
  const isKnownHtmlAttr = /* @__PURE__ */ makeMap(
    `accept,accept-charset,accesskey,action,align,allow,alt,async,autocapitalize,autocomplete,autofocus,autoplay,background,bgcolor,border,buffered,capture,challenge,charset,checked,cite,class,code,codebase,color,cols,colspan,content,contenteditable,contextmenu,controls,coords,crossorigin,csp,data,datetime,decoding,default,defer,dir,dirname,disabled,download,draggable,dropzone,enctype,enterkeyhint,for,form,formaction,formenctype,formmethod,formnovalidate,formtarget,headers,height,hidden,high,href,hreflang,http-equiv,icon,id,importance,inert,integrity,ismap,itemprop,keytype,kind,label,lang,language,loading,list,loop,low,manifest,max,maxlength,minlength,media,min,multiple,muted,name,novalidate,open,optimum,pattern,ping,placeholder,poster,preload,radiogroup,readonly,referrerpolicy,rel,required,reversed,rows,rowspan,sandbox,scope,scoped,selected,shape,size,sizes,slot,span,spellcheck,src,srcdoc,srclang,srcset,start,step,style,summary,tabindex,target,title,translate,type,usemap,value,width,wrap`
  );
  const isKnownSvgAttr = /* @__PURE__ */ makeMap(
    `xmlns,accent-height,accumulate,additive,alignment-baseline,alphabetic,amplitude,arabic-form,ascent,attributeName,attributeType,azimuth,baseFrequency,baseline-shift,baseProfile,bbox,begin,bias,by,calcMode,cap-height,class,clip,clipPathUnits,clip-path,clip-rule,color,color-interpolation,color-interpolation-filters,color-profile,color-rendering,contentScriptType,contentStyleType,crossorigin,cursor,cx,cy,d,decelerate,descent,diffuseConstant,direction,display,divisor,dominant-baseline,dur,dx,dy,edgeMode,elevation,enable-background,end,exponent,fill,fill-opacity,fill-rule,filter,filterRes,filterUnits,flood-color,flood-opacity,font-family,font-size,font-size-adjust,font-stretch,font-style,font-variant,font-weight,format,from,fr,fx,fy,g1,g2,glyph-name,glyph-orientation-horizontal,glyph-orientation-vertical,glyphRef,gradientTransform,gradientUnits,hanging,height,href,hreflang,horiz-adv-x,horiz-origin-x,id,ideographic,image-rendering,in,in2,intercept,k,k1,k2,k3,k4,kernelMatrix,kernelUnitLength,kerning,keyPoints,keySplines,keyTimes,lang,lengthAdjust,letter-spacing,lighting-color,limitingConeAngle,local,marker-end,marker-mid,marker-start,markerHeight,markerUnits,markerWidth,mask,maskContentUnits,maskUnits,mathematical,max,media,method,min,mode,name,numOctaves,offset,opacity,operator,order,orient,orientation,origin,overflow,overline-position,overline-thickness,panose-1,paint-order,path,pathLength,patternContentUnits,patternTransform,patternUnits,ping,pointer-events,points,pointsAtX,pointsAtY,pointsAtZ,preserveAlpha,preserveAspectRatio,primitiveUnits,r,radius,referrerPolicy,refX,refY,rel,rendering-intent,repeatCount,repeatDur,requiredExtensions,requiredFeatures,restart,result,rotate,rx,ry,scale,seed,shape-rendering,slope,spacing,specularConstant,specularExponent,speed,spreadMethod,startOffset,stdDeviation,stemh,stemv,stitchTiles,stop-color,stop-opacity,strikethrough-position,strikethrough-thickness,string,stroke,stroke-dasharray,stroke-dashoffset,stroke-linecap,stroke-linejoin,stroke-miterlimit,stroke-opacity,stroke-width,style,surfaceScale,systemLanguage,tabindex,tableValues,target,targetX,targetY,text-anchor,text-decoration,text-rendering,textLength,to,transform,transform-origin,type,u1,u2,underline-position,underline-thickness,unicode,unicode-bidi,unicode-range,units-per-em,v-alphabetic,v-hanging,v-ideographic,v-mathematical,values,vector-effect,version,vert-adv-y,vert-origin-x,vert-origin-y,viewBox,viewTarget,visibility,width,widths,word-spacing,writing-mode,x,x-height,x1,x2,xChannelSelector,xlink:actuate,xlink:arcrole,xlink:href,xlink:role,xlink:show,xlink:title,xlink:type,xmlns:xlink,xml:base,xml:lang,xml:space,y,y1,y2,yChannelSelector,z,zoomAndPan`
  );
  const isKnownMathMLAttr = /* @__PURE__ */ makeMap(
    `accent,accentunder,actiontype,align,alignmentscope,altimg,altimg-height,altimg-valign,altimg-width,alttext,bevelled,close,columnsalign,columnlines,columnspan,denomalign,depth,dir,display,displaystyle,encoding,equalcolumns,equalrows,fence,fontstyle,fontweight,form,frame,framespacing,groupalign,height,href,id,indentalign,indentalignfirst,indentalignlast,indentshift,indentshiftfirst,indentshiftlast,indextype,justify,largetop,largeop,lquote,lspace,mathbackground,mathcolor,mathsize,mathvariant,maxsize,minlabelspacing,mode,other,overflow,position,rowalign,rowlines,rowspan,rquote,rspace,scriptlevel,scriptminsize,scriptsizemultiplier,selection,separator,separators,shift,side,src,stackalign,stretchy,subscriptshift,superscriptshift,symmetric,voffset,width,widths,xlink:href,xlink:show,xlink:type,xmlns`
  );
  function isRenderableAttrValue(value) {
    if (value == null) {
      return false;
    }
    const type = typeof value;
    return type === "string" || type === "number" || type === "boolean";
  }
  const escapeRE = /["'&<>]/;
  function escapeHtml2(string) {
    const str = "" + string;
    const match = escapeRE.exec(str);
    if (!match) {
      return str;
    }
    let html = "";
    let escaped;
    let index;
    let lastIndex = 0;
    for (index = match.index; index < str.length; index++) {
      switch (str.charCodeAt(index)) {
        case 34:
          escaped = "&quot;";
          break;
        case 38:
          escaped = "&amp;";
          break;
        case 39:
          escaped = "&#39;";
          break;
        case 60:
          escaped = "&lt;";
          break;
        case 62:
          escaped = "&gt;";
          break;
        default:
          continue;
      }
      if (lastIndex !== index) {
        html += str.slice(lastIndex, index);
      }
      lastIndex = index + 1;
      html += escaped;
    }
    return lastIndex !== index ? html + str.slice(lastIndex, index) : html;
  }
  const commentStripRE = /^-?>|<!--|-->|--!>|<!-$/g;
  function escapeHtmlComment(src) {
    return src.replace(commentStripRE, "");
  }
  const cssVarNameEscapeSymbolsRE = /[ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~]/g;
  function getEscapedCssVarName(key, doubleEscape) {
    return key.replace(
      cssVarNameEscapeSymbolsRE,
      (s) => doubleEscape ? s === '"' ? '\\\\\\"' : `\\\\${s}` : `\\${s}`
    );
  }
  function looseCompareArrays(a, b) {
    if (a.length !== b.length) return false;
    let equal = true;
    for (let i = 0; equal && i < a.length; i++) {
      equal = looseEqual(a[i], b[i]);
    }
    return equal;
  }
  function looseEqual(a, b) {
    if (a === b) return true;
    let aValidType = isDate(a);
    let bValidType = isDate(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? a.getTime() === b.getTime() : false;
    }
    aValidType = isSymbol(a);
    bValidType = isSymbol(b);
    if (aValidType || bValidType) {
      return a === b;
    }
    aValidType = isArray(a);
    bValidType = isArray(b);
    if (aValidType || bValidType) {
      return aValidType && bValidType ? looseCompareArrays(a, b) : false;
    }
    aValidType = isObject(a);
    bValidType = isObject(b);
    if (aValidType || bValidType) {
      if (!aValidType || !bValidType) {
        return false;
      }
      const aKeysCount = Object.keys(a).length;
      const bKeysCount = Object.keys(b).length;
      if (aKeysCount !== bKeysCount) {
        return false;
      }
      for (const key in a) {
        const aHasKey = a.hasOwnProperty(key);
        const bHasKey = b.hasOwnProperty(key);
        if (aHasKey && !bHasKey || !aHasKey && bHasKey || !looseEqual(a[key], b[key])) {
          return false;
        }
      }
    }
    return String(a) === String(b);
  }
  function looseIndexOf(arr, val) {
    return arr.findIndex((item) => looseEqual(item, val));
  }
  const isRef = (val) => {
    return !!(val && val["__v_isRef"] === true);
  };
  const toDisplayString2 = (val) => {
    return isString(val) ? val : val == null ? "" : isArray(val) || isObject(val) && (val.toString === objectToString || !isFunction(val.toString)) ? isRef(val) ? toDisplayString2(val.value) : JSON.stringify(val, replacer, 2) : String(val);
  };
  const replacer = (_key, val) => {
    if (isRef(val)) {
      return replacer(_key, val.value);
    } else if (isMap(val)) {
      return {
        [`Map(${val.size})`]: [...val.entries()].reduce(
          (entries, [key, val2], i) => {
            entries[stringifySymbol(key, i) + " =>"] = val2;
            return entries;
          },
          {}
        )
      };
    } else if (isSet(val)) {
      return {
        [`Set(${val.size})`]: [...val.values()].map((v) => stringifySymbol(v))
      };
    } else if (isSymbol(val)) {
      return stringifySymbol(val);
    } else if (isObject(val) && !isArray(val) && !isPlainObject(val)) {
      return String(val);
    }
    return val;
  };
  const stringifySymbol = (v, i = "") => {
    var _a;
    return (
      // Symbol.description in es2019+ so we need to cast here to pass
      // the lib: es2016 check
      isSymbol(v) ? `Symbol(${(_a = v.description) != null ? _a : i})` : v
    );
  };
  function normalizeCssVarValue(value) {
    if (value == null) {
      return "initial";
    }
    if (typeof value === "string") {
      return value === "" ? " " : value;
    }
    return String(value);
  }
  shared_cjs_prod.EMPTY_ARR = EMPTY_ARR;
  shared_cjs_prod.EMPTY_OBJ = EMPTY_OBJ;
  shared_cjs_prod.NO = NO;
  shared_cjs_prod.NOOP = NOOP;
  shared_cjs_prod.PatchFlagNames = PatchFlagNames;
  shared_cjs_prod.PatchFlags = PatchFlags;
  shared_cjs_prod.ShapeFlags = ShapeFlags;
  shared_cjs_prod.SlotFlags = SlotFlags;
  shared_cjs_prod.camelize = camelize;
  shared_cjs_prod.capitalize = capitalize;
  shared_cjs_prod.cssVarNameEscapeSymbolsRE = cssVarNameEscapeSymbolsRE;
  shared_cjs_prod.def = def;
  shared_cjs_prod.escapeHtml = escapeHtml2;
  shared_cjs_prod.escapeHtmlComment = escapeHtmlComment;
  shared_cjs_prod.extend = extend;
  shared_cjs_prod.genCacheKey = genCacheKey;
  shared_cjs_prod.genPropsAccessExp = genPropsAccessExp;
  shared_cjs_prod.generateCodeFrame = generateCodeFrame;
  shared_cjs_prod.getEscapedCssVarName = getEscapedCssVarName;
  shared_cjs_prod.getGlobalThis = getGlobalThis;
  shared_cjs_prod.hasChanged = hasChanged;
  shared_cjs_prod.hasOwn = hasOwn;
  shared_cjs_prod.hyphenate = hyphenate;
  shared_cjs_prod.includeBooleanAttr = includeBooleanAttr;
  shared_cjs_prod.invokeArrayFns = invokeArrayFns;
  shared_cjs_prod.isArray = isArray;
  shared_cjs_prod.isBooleanAttr = isBooleanAttr;
  shared_cjs_prod.isBuiltInDirective = isBuiltInDirective;
  shared_cjs_prod.isDate = isDate;
  shared_cjs_prod.isFunction = isFunction;
  shared_cjs_prod.isGloballyAllowed = isGloballyAllowed;
  shared_cjs_prod.isGloballyWhitelisted = isGloballyWhitelisted;
  shared_cjs_prod.isHTMLTag = isHTMLTag;
  shared_cjs_prod.isIntegerKey = isIntegerKey;
  shared_cjs_prod.isKnownHtmlAttr = isKnownHtmlAttr;
  shared_cjs_prod.isKnownMathMLAttr = isKnownMathMLAttr;
  shared_cjs_prod.isKnownSvgAttr = isKnownSvgAttr;
  shared_cjs_prod.isMap = isMap;
  shared_cjs_prod.isMathMLTag = isMathMLTag;
  shared_cjs_prod.isModelListener = isModelListener;
  shared_cjs_prod.isObject = isObject;
  shared_cjs_prod.isOn = isOn;
  shared_cjs_prod.isPlainObject = isPlainObject;
  shared_cjs_prod.isPromise = isPromise;
  shared_cjs_prod.isRegExp = isRegExp;
  shared_cjs_prod.isRenderableAttrValue = isRenderableAttrValue;
  shared_cjs_prod.isReservedProp = isReservedProp;
  shared_cjs_prod.isSSRSafeAttrName = isSSRSafeAttrName;
  shared_cjs_prod.isSVGTag = isSVGTag;
  shared_cjs_prod.isSet = isSet;
  shared_cjs_prod.isSpecialBooleanAttr = isSpecialBooleanAttr;
  shared_cjs_prod.isString = isString;
  shared_cjs_prod.isSymbol = isSymbol;
  shared_cjs_prod.isVoidTag = isVoidTag;
  shared_cjs_prod.looseEqual = looseEqual;
  shared_cjs_prod.looseIndexOf = looseIndexOf;
  shared_cjs_prod.looseToNumber = looseToNumber;
  shared_cjs_prod.makeMap = makeMap;
  shared_cjs_prod.normalizeClass = normalizeClass;
  shared_cjs_prod.normalizeCssVarValue = normalizeCssVarValue;
  shared_cjs_prod.normalizeProps = normalizeProps;
  shared_cjs_prod.normalizeStyle = normalizeStyle;
  shared_cjs_prod.objectToString = objectToString;
  shared_cjs_prod.parseStringStyle = parseStringStyle;
  shared_cjs_prod.propsToAttrMap = propsToAttrMap;
  shared_cjs_prod.remove = remove;
  shared_cjs_prod.slotFlagsText = slotFlagsText;
  shared_cjs_prod.stringifyStyle = stringifyStyle;
  shared_cjs_prod.toDisplayString = toDisplayString2;
  shared_cjs_prod.toHandlerKey = toHandlerKey;
  shared_cjs_prod.toNumber = toNumber;
  shared_cjs_prod.toRawType = toRawType;
  shared_cjs_prod.toTypeString = toTypeString;
  return shared_cjs_prod;
}
var shared_cjs_prodExports = /* @__PURE__ */ requireShared_cjs_prod();
defineComponent({
  name: "ServerPlaceholder",
  render() {
    return createElementBlock("div");
  }
});
const clientOnlySymbol = /* @__PURE__ */ Symbol.for("nuxt:client-only");
defineComponent({
  name: "ClientOnly",
  inheritAttrs: false,
  props: ["fallback", "placeholder", "placeholderTag", "fallbackTag"],
  ...false,
  setup(props, { slots, attrs }) {
    const mounted = shallowRef(false);
    const vm = getCurrentInstance();
    if (vm) {
      vm._nuxtClientOnly = true;
    }
    provide(clientOnlySymbol, true);
    return () => {
      var _a;
      if (mounted.value) {
        const vnodes = (_a = slots.default) == null ? void 0 : _a.call(slots);
        if (vnodes && vnodes.length === 1) {
          return [cloneVNode(vnodes[0], attrs)];
        }
        return vnodes;
      }
      const slot = slots.fallback || slots.placeholder;
      if (slot) {
        return h(slot);
      }
      const fallbackStr = props.fallback || props.placeholder || "";
      const fallbackTag = props.fallbackTag || props.placeholderTag || "span";
      return createElementBlock(fallbackTag, attrs, fallbackStr);
    };
  }
});
const isDefer = (dedupe) => dedupe === "defer" || dedupe === false;
function useAsyncData(...args) {
  var _a, _b, _c, _d, _e, _f, _g;
  const autoKey = typeof args[args.length - 1] === "string" ? args.pop() : void 0;
  if (_isAutoKeyNeeded(args[0], args[1])) {
    args.unshift(autoKey);
  }
  let [_key, _handler, options = {}] = args;
  const key = computed(() => toValue(_key));
  if (typeof key.value !== "string") {
    throw new TypeError("[nuxt] [useAsyncData] key must be a string.");
  }
  if (typeof _handler !== "function") {
    throw new TypeError("[nuxt] [useAsyncData] handler must be a function.");
  }
  const nuxtApp = useNuxtApp();
  (_a = options.server) != null ? _a : options.server = true;
  (_b = options.default) != null ? _b : options.default = getDefault;
  (_c = options.getCachedData) != null ? _c : options.getCachedData = getDefaultCachedData;
  (_d = options.lazy) != null ? _d : options.lazy = false;
  (_e = options.immediate) != null ? _e : options.immediate = true;
  (_f = options.deep) != null ? _f : options.deep = asyncDataDefaults.deep;
  (_g = options.dedupe) != null ? _g : options.dedupe = "cancel";
  options._functionName || "useAsyncData";
  nuxtApp._asyncData[key.value];
  function createInitialFetch() {
    var _a2;
    const initialFetchOptions = { cause: "initial", dedupe: options.dedupe };
    if (!((_a2 = nuxtApp._asyncData[key.value]) == null ? void 0 : _a2._init)) {
      initialFetchOptions.cachedData = options.getCachedData(key.value, nuxtApp, { cause: "initial" });
      nuxtApp._asyncData[key.value] = createAsyncData(nuxtApp, key.value, _handler, options, initialFetchOptions.cachedData);
    }
    return () => nuxtApp._asyncData[key.value].execute(initialFetchOptions);
  }
  const initialFetch = createInitialFetch();
  const asyncData = nuxtApp._asyncData[key.value];
  asyncData._deps++;
  const fetchOnServer = options.server !== false && nuxtApp.payload.serverRendered;
  if (fetchOnServer && options.immediate) {
    const promise = initialFetch();
    if (getCurrentInstance()) {
      onServerPrefetch(() => promise);
    } else {
      nuxtApp.hook("app:created", async () => {
        await promise;
      });
    }
  }
  const asyncReturn = {
    data: writableComputedRef(() => {
      var _a2;
      return (_a2 = nuxtApp._asyncData[key.value]) == null ? void 0 : _a2.data;
    }),
    pending: writableComputedRef(() => {
      var _a2;
      return (_a2 = nuxtApp._asyncData[key.value]) == null ? void 0 : _a2.pending;
    }),
    status: writableComputedRef(() => {
      var _a2;
      return (_a2 = nuxtApp._asyncData[key.value]) == null ? void 0 : _a2.status;
    }),
    error: writableComputedRef(() => {
      var _a2;
      return (_a2 = nuxtApp._asyncData[key.value]) == null ? void 0 : _a2.error;
    }),
    refresh: (...args2) => {
      var _a2;
      if (!((_a2 = nuxtApp._asyncData[key.value]) == null ? void 0 : _a2._init)) {
        const initialFetch2 = createInitialFetch();
        return initialFetch2();
      }
      return nuxtApp._asyncData[key.value].execute(...args2);
    },
    execute: (...args2) => asyncReturn.refresh(...args2),
    clear: () => {
      const entry = nuxtApp._asyncData[key.value];
      if (entry == null ? void 0 : entry._abortController) {
        try {
          entry._abortController.abort(new DOMException("AsyncData aborted by user.", "AbortError"));
        } finally {
          entry._abortController = void 0;
        }
      }
      clearNuxtDataByKey(nuxtApp, key.value);
    }
  };
  const asyncDataPromise = Promise.resolve(nuxtApp._asyncDataPromises[key.value]).then(() => asyncReturn);
  Object.assign(asyncDataPromise, asyncReturn);
  return asyncDataPromise;
}
function writableComputedRef(getter) {
  return computed({
    get() {
      var _a;
      return (_a = getter()) == null ? void 0 : _a.value;
    },
    set(value) {
      const ref2 = getter();
      if (ref2) {
        ref2.value = value;
      }
    }
  });
}
function _isAutoKeyNeeded(keyOrFetcher, fetcher) {
  if (typeof keyOrFetcher === "string") {
    return false;
  }
  if (typeof keyOrFetcher === "object" && keyOrFetcher !== null) {
    return false;
  }
  if (typeof keyOrFetcher === "function" && typeof fetcher === "function") {
    return false;
  }
  return true;
}
function clearNuxtDataByKey(nuxtApp, key) {
  if (key in nuxtApp.payload.data) {
    nuxtApp.payload.data[key] = void 0;
  }
  if (key in nuxtApp.payload._errors) {
    nuxtApp.payload._errors[key] = asyncDataDefaults.errorValue;
  }
  if (nuxtApp._asyncData[key]) {
    nuxtApp._asyncData[key].data.value = void 0;
    nuxtApp._asyncData[key].error.value = asyncDataDefaults.errorValue;
    {
      nuxtApp._asyncData[key].pending.value = false;
    }
    nuxtApp._asyncData[key].status.value = "idle";
  }
  if (key in nuxtApp._asyncDataPromises) {
    nuxtApp._asyncDataPromises[key] = void 0;
  }
}
function pick(obj, keys) {
  const newObj = {};
  for (const key of keys) {
    newObj[key] = obj[key];
  }
  return newObj;
}
function createAsyncData(nuxtApp, key, _handler, options, initialCachedData) {
  var _a, _b;
  (_b = (_a = nuxtApp.payload._errors)[key]) != null ? _b : _a[key] = asyncDataDefaults.errorValue;
  const hasCustomGetCachedData = options.getCachedData !== getDefaultCachedData;
  const handler = _handler ;
  const _ref = options.deep ? ref : shallowRef;
  const hasCachedData = initialCachedData != null;
  const unsubRefreshAsyncData = nuxtApp.hook("app:data:refresh", async (keys) => {
    if (!keys || keys.includes(key)) {
      await asyncData.execute({ cause: "refresh:hook" });
    }
  });
  const asyncData = {
    data: _ref(hasCachedData ? initialCachedData : options.default()),
    pending: shallowRef(!hasCachedData),
    error: toRef(nuxtApp.payload._errors, key),
    status: shallowRef("idle"),
    execute: (...args) => {
      var _a2, _b2;
      const [_opts, newValue = void 0] = args;
      const opts = _opts && newValue === void 0 && typeof _opts === "object" ? _opts : {};
      if (nuxtApp._asyncDataPromises[key]) {
        if (isDefer((_a2 = opts.dedupe) != null ? _a2 : options.dedupe)) {
          return nuxtApp._asyncDataPromises[key];
        }
      }
      if (opts.cause === "initial" || nuxtApp.isHydrating) {
        const cachedData = "cachedData" in opts ? opts.cachedData : options.getCachedData(key, nuxtApp, { cause: (_b2 = opts.cause) != null ? _b2 : "refresh:manual" });
        if (cachedData != null) {
          nuxtApp.payload.data[key] = asyncData.data.value = cachedData;
          asyncData.error.value = asyncDataDefaults.errorValue;
          asyncData.status.value = "success";
          return Promise.resolve(cachedData);
        }
      }
      {
        asyncData.pending.value = true;
      }
      if (asyncData._abortController) {
        asyncData._abortController.abort(new DOMException("AsyncData request cancelled by deduplication", "AbortError"));
      }
      asyncData._abortController = new AbortController();
      asyncData.status.value = "pending";
      const cleanupController = new AbortController();
      const promise = new Promise(
        (resolve, reject) => {
          var _a3, _b3;
          try {
            const timeout = (_a3 = opts.timeout) != null ? _a3 : options.timeout;
            const mergedSignal = mergeAbortSignals([(_b3 = asyncData._abortController) == null ? void 0 : _b3.signal, opts == null ? void 0 : opts.signal], cleanupController.signal, timeout);
            if (mergedSignal.aborted) {
              const reason = mergedSignal.reason;
              reject(reason instanceof Error ? reason : new DOMException(String(reason != null ? reason : "Aborted"), "AbortError"));
              return;
            }
            mergedSignal.addEventListener("abort", () => {
              const reason = mergedSignal.reason;
              reject(reason instanceof Error ? reason : new DOMException(String(reason != null ? reason : "Aborted"), "AbortError"));
            }, { once: true, signal: cleanupController.signal });
            return Promise.resolve(handler(nuxtApp, { signal: mergedSignal })).then(resolve, reject);
          } catch (err) {
            reject(err);
          }
        }
      ).then(async (_result) => {
        let result = _result;
        if (options.transform) {
          result = await options.transform(_result);
        }
        if (options.pick) {
          result = pick(result, options.pick);
        }
        nuxtApp.payload.data[key] = result;
        asyncData.data.value = result;
        asyncData.error.value = asyncDataDefaults.errorValue;
        asyncData.status.value = "success";
      }).catch((error) => {
        var _a3;
        if (nuxtApp._asyncDataPromises[key] && nuxtApp._asyncDataPromises[key] !== promise) {
          return nuxtApp._asyncDataPromises[key];
        }
        if ((_a3 = asyncData._abortController) == null ? void 0 : _a3.signal.aborted) {
          return nuxtApp._asyncDataPromises[key];
        }
        if (typeof DOMException !== "undefined" && error instanceof DOMException && error.name === "AbortError") {
          asyncData.status.value = "idle";
          return nuxtApp._asyncDataPromises[key];
        }
        asyncData.error.value = createError(error);
        asyncData.data.value = unref(options.default());
        asyncData.status.value = "error";
      }).finally(() => {
        {
          asyncData.pending.value = false;
        }
        cleanupController.abort();
        delete nuxtApp._asyncDataPromises[key];
      });
      nuxtApp._asyncDataPromises[key] = promise;
      return nuxtApp._asyncDataPromises[key];
    },
    _execute: debounce((...args) => asyncData.execute(...args), 0, { leading: true }),
    _default: options.default,
    _deps: 0,
    _init: true,
    _hash: void 0,
    _off: () => {
      var _a2;
      unsubRefreshAsyncData();
      if ((_a2 = nuxtApp._asyncData[key]) == null ? void 0 : _a2._init) {
        nuxtApp._asyncData[key]._init = false;
      }
      if (!hasCustomGetCachedData) {
        nextTick(() => {
          var _a3;
          if (!((_a3 = nuxtApp._asyncData[key]) == null ? void 0 : _a3._init)) {
            clearNuxtDataByKey(nuxtApp, key);
            asyncData.execute = () => Promise.resolve();
            asyncData.data.value = asyncDataDefaults.value;
          }
        });
      }
    }
  };
  return asyncData;
}
const getDefault = () => asyncDataDefaults.value;
const getDefaultCachedData = (key, nuxtApp, ctx) => {
  if (nuxtApp.isHydrating) {
    return nuxtApp.payload.data[key];
  }
  if (ctx.cause !== "refresh:manual" && ctx.cause !== "refresh:hook") {
    return nuxtApp.static.data[key];
  }
};
function mergeAbortSignals(signals, cleanupSignal, timeout) {
  var _a, _b, _c;
  const list = signals.filter((s) => !!s);
  if (typeof timeout === "number" && timeout >= 0) {
    const timeoutSignal = (_a = AbortSignal.timeout) == null ? void 0 : _a.call(AbortSignal, timeout);
    if (timeoutSignal) {
      list.push(timeoutSignal);
    }
  }
  if (AbortSignal.any) {
    return AbortSignal.any(list);
  }
  const controller = new AbortController();
  for (const sig of list) {
    if (sig.aborted) {
      const reason = (_b = sig.reason) != null ? _b : new DOMException("Aborted", "AbortError");
      try {
        controller.abort(reason);
      } catch {
        controller.abort();
      }
      return controller.signal;
    }
  }
  const onAbort = () => {
    var _a2;
    const abortedSignal = list.find((s) => s.aborted);
    const reason = (_a2 = abortedSignal == null ? void 0 : abortedSignal.reason) != null ? _a2 : new DOMException("Aborted", "AbortError");
    try {
      controller.abort(reason);
    } catch {
      controller.abort();
    }
  };
  for (const sig of list) {
    (_c = sig.addEventListener) == null ? void 0 : _c.call(sig, "abort", onAbort, { once: true, signal: cleanupSignal });
  }
  return controller.signal;
}
function useRequestEvent(nuxtApp) {
  var _a;
  nuxtApp || (nuxtApp = useNuxtApp());
  return (_a = nuxtApp.ssrContext) == null ? void 0 : _a.event;
}
function useRequestFetch() {
  var _a;
  return ((_a = useRequestEvent()) == null ? void 0 : _a.$fetch) || globalThis.$fetch;
}
function useFetch(request, arg1, arg2) {
  const [opts = {}, autoKey] = typeof arg1 === "string" ? [{}, arg1] : [arg1, arg2];
  const _request = computed(() => toValue(request));
  const key = computed(() => toValue(opts.key) || "$f" + hash([autoKey, typeof _request.value === "string" ? _request.value : "", ...generateOptionSegments(opts)]));
  if (!opts.baseURL && typeof _request.value === "string" && (_request.value[0] === "/" && _request.value[1] === "/")) {
    throw new Error('[nuxt] [useFetch] the request URL must not start with "//".');
  }
  const {
    server,
    lazy,
    default: defaultFn,
    transform,
    pick: pick2,
    watch: watchSources,
    immediate,
    getCachedData,
    deep,
    dedupe,
    timeout,
    ...fetchOptions
  } = opts;
  const _fetchOptions = reactive({
    ...fetchDefaults,
    ...fetchOptions,
    cache: typeof opts.cache === "boolean" ? void 0 : opts.cache
  });
  const _asyncDataOptions = {
    server,
    lazy,
    default: defaultFn,
    transform,
    pick: pick2,
    immediate,
    getCachedData,
    deep,
    dedupe,
    timeout,
    watch: watchSources === false ? [] : [...watchSources || [], _fetchOptions]
  };
  if (!immediate) {
    let setImmediate = function() {
      _asyncDataOptions.immediate = true;
    };
    watch(key, setImmediate, { flush: "sync", once: true });
    watch([...watchSources || [], _fetchOptions], setImmediate, { flush: "sync", once: true });
  }
  const asyncData = useAsyncData(watchSources === false ? key.value : key, (_, { signal }) => {
    let _$fetch = opts.$fetch || globalThis.$fetch;
    if (!opts.$fetch) {
      const isLocalFetch = typeof _request.value === "string" && _request.value[0] === "/" && (!toValue(opts.baseURL) || toValue(opts.baseURL)[0] === "/");
      if (isLocalFetch) {
        _$fetch = useRequestFetch();
      }
    }
    return _$fetch(_request.value, { signal, ..._fetchOptions });
  }, _asyncDataOptions);
  return asyncData;
}
function generateOptionSegments(opts) {
  var _a;
  const segments = [
    ((_a = toValue(opts.method)) == null ? void 0 : _a.toUpperCase()) || "GET",
    toValue(opts.baseURL)
  ];
  for (const _obj of [opts.query || opts.params]) {
    const obj = toValue(_obj);
    if (!obj) {
      continue;
    }
    const unwrapped = {};
    for (const [key, value] of Object.entries(obj)) {
      unwrapped[toValue(key)] = toValue(value);
    }
    segments.push(unwrapped);
  }
  if (opts.body) {
    const value = toValue(opts.body);
    if (!value) {
      segments.push(hash(value));
    } else if (value instanceof ArrayBuffer) {
      segments.push(hash(Object.fromEntries([...new Uint8Array(value).entries()].map(([k, v]) => [k, v.toString()]))));
    } else if (value instanceof FormData) {
      const obj = {};
      for (const entry of value.entries()) {
        const [key, val] = entry;
        obj[key] = val instanceof File ? val.name : val;
      }
      segments.push(hash(obj));
    } else if (shared_cjs_prodExports.isPlainObject(value)) {
      segments.push(hash(reactive(value)));
    } else {
      try {
        segments.push(hash(value));
      } catch {
        console.warn("[useFetch] Failed to hash body", value);
      }
    }
  }
  return segments;
}
const STORAGE_KEY = "fd:omni:recents";
const DEBOUNCE_MS = 150;
const _sfc_main$9 = /* @__PURE__ */ defineComponent({
  __name: "SearchDialog",
  __ssrInlineRender: true,
  emits: ["close"],
  setup(__props, { emit: __emit }) {
    const query = ref("");
    const currentResults = ref([]);
    const loading = ref(false);
    const activeIndex = ref(0);
    ref(null);
    let debounceTimer = null;
    function getRecents() {
      if (typeof localStorage === "undefined") return [];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
      } catch {
        return [];
      }
    }
    const recentsList = ref([]);
    computed(() => {
      const q = query.value.trim();
      if (q && currentResults.value.length) return currentResults.value.map((r) => {
        var _a;
        return { id: r.url, label: r.content, url: r.url, subtitle: (_a = r.description) != null ? _a : "Page" };
      });
      return recentsList.value.map((r) => ({ id: r.id, label: r.label, url: r.url, subtitle: "Recently viewed" }));
    });
    const showRecents = computed(() => !query.value.trim());
    const showDocs = computed(() => !!query.value.trim() && currentResults.value.length > 0);
    const showEmpty = computed(() => {
      if (query.value.trim()) return currentResults.value.length === 0 && !loading.value;
      return recentsList.value.length === 0;
    });
    const emptyText = computed(
      () => query.value.trim() ? "No results found. Try a different query." : "Type to search the docs, or browse recent items."
    );
    function loadRecents() {
      recentsList.value = getRecents();
    }
    function onInput() {
      loadRecents();
      const q = query.value.trim();
      loading.value = false;
      currentResults.value = [];
      activeIndex.value = 0;
      if (!q) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        loading.value = true;
        try {
          const res = await fetch(`/api/docs?query=${encodeURIComponent(q)}`);
          const data = res.ok ? await res.json() : [];
          currentResults.value = Array.isArray(data) ? data : [];
          activeIndex.value = 0;
        } catch {
          currentResults.value = [];
        } finally {
          loading.value = false;
        }
      }, DEBOUNCE_MS);
    }
    watch(query, onInput);
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        class: "omni-overlay",
        "aria-hidden": "true"
      }, _attrs))}><div class="omni-content" role="dialog" aria-label="Search documentation"><div class="omni-header"><div class="omni-search-row"><span class="omni-search-icon" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg></span><input${ssrRenderAttr("value", query.value)} type="text" class="omni-search-input" role="combobox" aria-expanded="true" aria-controls="fd-omni-listbox" placeholder="Search documentation\u2026" autocomplete="off"><kbd class="omni-kbd">\u2318 K</kbd><button type="button" aria-label="Close" class="omni-close-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div></div><div id="fd-omni-listbox" class="omni-body" role="listbox" aria-label="Search results">`);
      if (loading.value) {
        _push(`<div class="omni-loading"><svg class="omni-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg> Searching\u2026 </div>`);
      } else if (showRecents.value && recentsList.value.length) {
        _push(`<div id="fd-omni-recent-group" class="omni-group"><div class="omni-group-label">Recent</div><div id="fd-omni-recent-items" class="omni-group-items"><!--[-->`);
        ssrRenderList(recentsList.value, (r, i) => {
          _push(`<div class="${ssrRenderClass([{ "omni-item-active": showRecents.value && i === activeIndex.value }, "omni-item"])}"${ssrRenderAttr("data-url", r.url)} role="option"${ssrRenderAttr("aria-selected", showRecents.value && i === activeIndex.value)} tabindex="-1"><div class="omni-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path></svg></div><div class="omni-item-text"><div class="omni-item-label">${ssrInterpolate(r.label)}</div><div class="omni-item-subtitle">Recently viewed</div></div><a${ssrRenderAttr("href", r.url)} class="omni-item-ext" title="Open in new tab" target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a><span class="omni-item-chevron" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></span></div>`);
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showDocs.value) {
        _push(`<div id="fd-omni-docs-group" class="omni-group"><div class="omni-group-label">Documentation</div><div id="fd-omni-docs-items" class="omni-group-items"><!--[-->`);
        ssrRenderList(currentResults.value, (r, i) => {
          var _a;
          _push(`<div class="${ssrRenderClass([{ "omni-item-active": showDocs.value && i === activeIndex.value }, "omni-item"])}"${ssrRenderAttr("data-url", r.url)} role="option"${ssrRenderAttr("aria-selected", showDocs.value && i === activeIndex.value)} tabindex="-1"><div class="omni-item-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"></path><path d="M14 2v4a2 2 0 0 0 2 2h4"></path></svg></div><div class="omni-item-text"><div class="omni-item-label">${ssrInterpolate(r.content)}</div><div class="omni-item-subtitle">${ssrInterpolate((_a = r.description) != null ? _a : "Page")}</div></div><a${ssrRenderAttr("href", r.url)} class="omni-item-ext" title="Open in new tab" target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></a><span class="omni-item-chevron" aria-hidden="true"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></span></div>`);
        });
        _push(`<!--]--></div></div>`);
      } else {
        _push(`<!---->`);
      }
      if (showEmpty.value) {
        _push(`<div class="omni-empty"><div class="omni-empty-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg></div><span>${ssrInterpolate(emptyText.value)}</span></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div><div class="omni-footer"><div class="omni-footer-inner"><div class="omni-footer-hints"><span class="omni-footer-hint"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg> to select </span><span class="omni-footer-hint"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 15l-6-6-6 6"></path></svg><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"></path></svg> to navigate </span><span class="omni-footer-hint omni-footer-hint-desktop"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg> to close </span></div></div></div></div></div>`);
    };
  }
});
const _sfc_setup$9 = _sfc_main$9.setup;
_sfc_main$9.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../../node_modules/.pnpm/@farming-labs+nuxt-theme@0.0.19_nuxt@3.21.1_@parcel+watcher@2.5.6_@types+node@22.19.11_@verce_c2kauwg57ebbaat4wvbaomz2li/node_modules/@farming-labs/nuxt-theme/src/components/SearchDialog.vue");
  return _sfc_setup$9 ? _sfc_setup$9(props, ctx) : void 0;
};
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function buildCodeBlock(lang, code) {
  const trimmed = code.replace(/\n$/, "");
  const highlighted = highlight(trimmed).replace(/<\/span>\n<span/g, "</span><span");
  const langLabel = lang ? `<div class="fd-ai-code-lang">${escapeHtml(lang)}</div>` : "";
  const copyBtn = `<button class="fd-ai-code-copy" onclick="(function(btn){var code=btn.closest('.fd-ai-code-block').querySelector('code').textContent;navigator.clipboard.writeText(code).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},1500)})})(this)">Copy</button>`;
  return `<div class="fd-ai-code-block"><div class="fd-ai-code-header">${langLabel}${copyBtn}</div><pre><code>${highlighted}</code></pre></div>`;
}
function isTableRow(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.includes("|");
}
function isTableSeparator(line) {
  return /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|$/.test(line.trim());
}
function renderTable(rows) {
  const parseRow = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const headerCells = parseRow(rows[0]);
  const thead = `<thead><tr>${headerCells.map((c) => `<th>${c}</th>`).join("")}</tr></thead>`;
  const bodyRows = rows.slice(1).map((row) => {
    const cells = parseRow(row);
    return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
  }).join("");
  return `<table>${thead}<tbody>${bodyRows}</tbody></table>`;
}
function renderMarkdown(text) {
  if (!text) return "";
  const codeBlocks = [];
  let processed = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
    codeBlocks.push(buildCodeBlock(lang, code));
    return `\0CB${codeBlocks.length - 1}\0`;
  });
  processed = processed.replace(/```(\w*)\n([\s\S]*)$/, (_match, lang, code) => {
    codeBlocks.push(buildCodeBlock(lang, code));
    return `\0CB${codeBlocks.length - 1}\0`;
  });
  const lines = processed.split("\n");
  const output = [];
  let i = 0;
  while (i < lines.length) {
    if (isTableRow(lines[i]) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines = [lines[i]];
      i++;
      i++;
      while (i < lines.length && isTableRow(lines[i])) {
        tableLines.push(lines[i]);
        i++;
      }
      output.push(renderTable(tableLines));
      continue;
    }
    output.push(lines[i]);
    i++;
  }
  let result = output.join("\n");
  result = result.replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(new RegExp("(?<!\\*)\\*([^*]+)\\*(?!\\*)", "g"), "<em>$1</em>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>').replace(/^### (.*$)/gm, "<h4>$1</h4>").replace(/^## (.*$)/gm, "<h3>$1</h3>").replace(/^# (.*$)/gm, "<h2>$1</h2>").replace(
    /^[-*] (.*$)/gm,
    '<div style="display:flex;gap:8px;padding:2px 0"><span style="opacity:0.5">\u2022</span><span>$1</span></div>'
  ).replace(
    /^(\d+)\. (.*$)/gm,
    '<div style="display:flex;gap:8px;padding:2px 0"><span style="opacity:0.5">$1.</span><span>$2</span></div>'
  ).replace(/\n\n/g, '<div style="height:8px"></div>').replace(/\n/g, "<br>");
  result = result.replace(/\x00CB(\d+)\x00/g, (_m, idx) => codeBlocks[Number(idx)]);
  return result;
}
const _sfc_main$8 = /* @__PURE__ */ defineComponent({
  __name: "FloatingAIChat",
  __ssrInlineRender: true,
  props: {
    api: { default: "/api/docs" },
    suggestedQuestions: { default: () => [] },
    aiLabel: { default: "AI" },
    position: { default: "bottom-right" },
    floatingStyle: { default: "panel" },
    triggerComponent: { default: null }
  },
  setup(__props) {
    const props = __props;
    const mounted = ref(false);
    const isOpen = ref(false);
    const messages = ref([]);
    const aiInput = ref("");
    const isStreaming = ref(false);
    const fmListEl = ref(null);
    const fmInputEl = ref(null);
    const messagesEndEl = ref(null);
    const isFullModal = computed(() => props.floatingStyle === "full-modal");
    const isModal = computed(() => props.floatingStyle === "modal");
    const label = computed(() => props.aiLabel || "AI");
    const canSend = computed(() => !!aiInput.value.trim() && !isStreaming.value);
    const showSuggestions = computed(() => messages.value.length === 0 && !isStreaming.value);
    const BTN_POSITIONS = {
      "bottom-right": "bottom:24px;right:24px",
      "bottom-left": "bottom:24px;left:24px",
      "bottom-center": "bottom:24px;left:50%;transform:translateX(-50%)"
    };
    const PANEL_POSITIONS = {
      "bottom-right": "bottom:80px;right:24px",
      "bottom-left": "bottom:80px;left:24px",
      "bottom-center": "bottom:80px;left:50%;transform:translateX(-50%)"
    };
    const btnStyle = computed(() => {
      var _a;
      return (_a = BTN_POSITIONS[props.position]) != null ? _a : BTN_POSITIONS["bottom-right"];
    });
    const containerStyle = computed(() => {
      var _a, _b;
      switch (props.floatingStyle) {
        case "modal":
          return "top:50%;left:50%;transform:translate(-50%,-50%);width:min(680px,calc(100vw - 32px));height:min(560px,calc(100vh - 64px))";
        case "popover":
          return `${(_a = PANEL_POSITIONS[props.position]) != null ? _a : PANEL_POSITIONS["bottom-right"]};width:min(360px,calc(100vw - 48px));height:min(400px,calc(100vh - 120px))`;
        default:
          return `${(_b = PANEL_POSITIONS[props.position]) != null ? _b : PANEL_POSITIONS["bottom-right"]};width:min(400px,calc(100vw - 48px));height:min(500px,calc(100vh - 120px))`;
      }
    });
    const animation = computed(
      () => props.floatingStyle === "modal" ? "fd-ai-float-center-in 200ms ease-out" : "fd-ai-float-in 200ms ease-out"
    );
    watch(isOpen, (open) => {
      if (open && (isModal.value || isFullModal.value)) {
        (void 0).body.style.overflow = "hidden";
      } else {
        (void 0).body.style.overflow = "";
      }
      if (open && isFullModal.value) {
        nextTick(() => {
          var _a;
          return (_a = fmInputEl.value) == null ? void 0 : _a.focus();
        });
      }
      if (open && !isFullModal.value) {
        nextTick(() => {
          const input = (void 0).querySelector(".fd-ai-input");
          input == null ? void 0 : input.focus();
        });
      }
    });
    watch(
      () => messages.value.length,
      () => {
        if (isFullModal.value && fmListEl.value) {
          nextTick(
            () => {
              var _a;
              return (_a = fmListEl.value) == null ? void 0 : _a.scrollTo({ top: fmListEl.value.scrollHeight, behavior: "smooth" });
            }
          );
        }
        if (!isFullModal.value) {
          nextTick(() => {
            var _a;
            return (_a = messagesEndEl.value) == null ? void 0 : _a.scrollIntoView({ behavior: "smooth" });
          });
        }
      }
    );
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<!--[-->`);
      if (mounted.value && isFullModal.value && isOpen.value) {
        ssrRenderTeleport(_push, (_push2) => {
          _push2(`<div class="fd-ai-fm-overlay"><div class="fd-ai-fm-topbar"><button class="fd-ai-fm-close-btn" type="button" aria-label="Close"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg></button></div><div class="fd-ai-fm-messages"><div class="fd-ai-fm-messages-inner"><!--[-->`);
          ssrRenderList(messages.value, (msg, i) => {
            var _a;
            _push2(`<div class="fd-ai-fm-msg"${ssrRenderAttr("data-role", msg.role)}><div class="fd-ai-fm-msg-label"${ssrRenderAttr("data-role", msg.role)}>${ssrInterpolate(msg.role === "user" ? "you" : label.value)}</div><div class="fd-ai-fm-msg-content">`);
            if (msg.content) {
              _push2(`<div class="${ssrRenderClass(isStreaming.value && i === messages.value.length - 1 && msg.role === "assistant" ? "fd-ai-streaming" : "")}">${(_a = unref(renderMarkdown)(msg.content)) != null ? _a : ""}</div>`);
            } else {
              _push2(`<div class="fd-ai-loader"><span class="fd-ai-loader-shimmer-text">Thinking</span><span class="fd-ai-loader-typing-dots"><span class="fd-ai-loader-typing-dot"></span><span class="fd-ai-loader-typing-dot"></span><span class="fd-ai-loader-typing-dot"></span></span></div>`);
            }
            _push2(`</div></div>`);
          });
          _push2(`<!--]--></div></div></div>`);
        }, "body", false, _parent);
      } else {
        _push(`<!---->`);
      }
      if (mounted.value && isFullModal.value) {
        ssrRenderTeleport(_push, (_push2) => {
          _push2(`<div class="${ssrRenderClass([isOpen.value ? "fd-ai-fm-input-bar--open" : "fd-ai-fm-input-bar--closed", "fd-ai-fm-input-bar"])}" style="${ssrRenderStyle(isOpen.value ? void 0 : btnStyle.value)}">`);
          if (!isOpen.value && __props.triggerComponent) {
            _push2(`<div class="fd-ai-floating-trigger" style="${ssrRenderStyle(btnStyle.value)}">`);
            ssrRenderVNode(_push2, createVNode(resolveDynamicComponent(__props.triggerComponent), { "ai-label": label.value }, null), _parent);
            _push2(`</div>`);
          } else if (!isOpen.value) {
            _push2(`<button class="fd-ai-fm-trigger-btn" type="button"${ssrRenderAttr("aria-label", `Ask ${label.value}`)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path></svg><span>Ask ${ssrInterpolate(label.value)}</span></button>`);
          } else {
            _push2(`<div class="fd-ai-fm-input-container"><div class="fd-ai-fm-input-wrap"><textarea class="fd-ai-fm-input"${ssrRenderAttr("placeholder", isStreaming.value ? "answering..." : `Ask ${label.value}`)}${ssrIncludeBooleanAttr(isStreaming.value) ? " disabled" : ""} rows="1">${ssrInterpolate(aiInput.value)}</textarea>`);
            if (isStreaming.value) {
              _push2(`<button class="fd-ai-fm-send-btn" type="button" aria-label="Stop"><span class="fd-ai-loader-typing-dots" style="${ssrRenderStyle({ "margin-left": "0" })}"><span class="fd-ai-loader-typing-dot"></span><span class="fd-ai-loader-typing-dot"></span><span class="fd-ai-loader-typing-dot"></span></span></button>`);
            } else {
              _push2(`<button class="fd-ai-fm-send-btn" type="button"${ssrRenderAttr("data-active", canSend.value)}${ssrIncludeBooleanAttr(!canSend.value) ? " disabled" : ""} aria-label="Send"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path></svg></button>`);
            }
            _push2(`</div>`);
            if (showSuggestions.value && __props.suggestedQuestions.length > 0) {
              _push2(`<div class="fd-ai-fm-suggestions-area"><div class="fd-ai-fm-suggestions-label">Try asking:</div><div class="fd-ai-fm-suggestions"><!--[-->`);
              ssrRenderList(__props.suggestedQuestions, (q) => {
                _push2(`<button type="button" class="fd-ai-fm-suggestion">${ssrInterpolate(q)}</button>`);
              });
              _push2(`<!--]--></div></div>`);
            } else {
              _push2(`<!---->`);
            }
            _push2(`<div class="fd-ai-fm-footer-bar">`);
            if (messages.value.length > 0) {
              _push2(`<button class="fd-ai-fm-clear-btn" type="button"${ssrRenderAttr("aria-disabled", isStreaming.value)}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg><span>Clear</span></button>`);
            } else {
              _push2(`<div class="fd-ai-fm-footer-hint"> AI can be inaccurate, please verify the information. </div>`);
            }
            _push2(`</div></div>`);
          }
          _push2(`</div>`);
        }, "body", false, _parent);
      } else {
        _push(`<!---->`);
      }
      if (mounted.value && !isFullModal.value && isOpen.value && isModal.value) {
        ssrRenderTeleport(_push, (_push2) => {
          _push2(`<div class="fd-ai-overlay"></div>`);
        }, "body", false, _parent);
      } else {
        _push(`<!---->`);
      }
      if (mounted.value && !isFullModal.value && isOpen.value) {
        ssrRenderTeleport(_push, (_push2) => {
          _push2(`<div class="fd-ai-dialog" style="${ssrRenderStyle(`${containerStyle.value};animation:${animation.value}`)}"><div class="fd-ai-header"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path></svg><span class="fd-ai-header-title">Ask ${ssrInterpolate(label.value)}</span><button type="button" class="fd-ai-close-btn" aria-label="Close"><kbd class="fd-ai-esc">ESC</kbd></button></div><div class="fd-ai-messages">`);
          if (messages.value.length === 0 && !isStreaming.value) {
            _push2(`<div class="fd-ai-empty"><div class="fd-ai-empty-title">Ask anything about the docs</div><div class="fd-ai-empty-desc">Get instant answers from the documentation.</div>`);
            if (__props.suggestedQuestions.length > 0) {
              _push2(`<div class="fd-ai-suggestions"><!--[-->`);
              ssrRenderList(__props.suggestedQuestions, (q) => {
                _push2(`<button type="button" class="fd-ai-suggestion">${ssrInterpolate(q)}</button>`);
              });
              _push2(`<!--]--></div>`);
            } else {
              _push2(`<!---->`);
            }
            _push2(`</div>`);
          } else {
            _push2(`<!---->`);
          }
          _push2(`<!--[-->`);
          ssrRenderList(messages.value, (msg, i) => {
            var _a;
            _push2(`<div class="fd-ai-msg"${ssrRenderAttr("data-role", msg.role)}><div class="fd-ai-msg-label">${ssrInterpolate(msg.role === "user" ? "You" : label.value)}</div>`);
            if (msg.role === "user") {
              _push2(`<div class="fd-ai-bubble-user">${ssrInterpolate(msg.content)}</div>`);
            } else {
              _push2(`<div class="fd-ai-bubble-ai">`);
              if (msg.content) {
                _push2(`<div class="${ssrRenderClass(isStreaming.value && i === messages.value.length - 1 ? "fd-ai-streaming" : "")}">${(_a = unref(renderMarkdown)(msg.content)) != null ? _a : ""}</div>`);
              } else {
                _push2(`<div class="fd-ai-loader"><span class="fd-ai-loader-shimmer-text">Thinking</span><span class="fd-ai-loader-typing-dots"><span class="fd-ai-loader-typing-dot"></span><span class="fd-ai-loader-typing-dot"></span><span class="fd-ai-loader-typing-dot"></span></span></div>`);
              }
              _push2(`</div>`);
            }
            _push2(`</div>`);
          });
          _push2(`<!--]--><div></div></div><div class="fd-ai-chat-footer"><div class="fd-ai-input-wrap"><input${ssrRenderAttr("value", aiInput.value)} type="text" class="fd-ai-input"${ssrRenderAttr("placeholder", isStreaming.value ? `${label.value} is answering...` : `Ask ${label.value}...`)}${ssrIncludeBooleanAttr(isStreaming.value) ? " disabled" : ""}><button type="button" class="fd-ai-send-btn"${ssrRenderAttr("data-active", canSend.value)}${ssrIncludeBooleanAttr(!canSend.value) ? " disabled" : ""} aria-label="Send"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 7-7 7 7"></path><path d="M12 19V5"></path></svg></button></div>`);
          if (messages.value.length > 0 && !isStreaming.value) {
            _push2(`<button type="button" class="fd-ai-clear-btn"> Clear conversation </button>`);
          } else {
            _push2(`<!---->`);
          }
          _push2(`</div></div>`);
        }, "body", false, _parent);
      } else {
        _push(`<!---->`);
      }
      if (mounted.value && !isFullModal.value && !isOpen.value) {
        ssrRenderTeleport(_push, (_push2) => {
          if (__props.triggerComponent) {
            _push2(`<div class="fd-ai-floating-trigger" style="${ssrRenderStyle(btnStyle.value)}">`);
            ssrRenderVNode(_push2, createVNode(resolveDynamicComponent(__props.triggerComponent), { "ai-label": label.value }, null), _parent);
            _push2(`</div>`);
          } else {
            _push2(`<button type="button" class="fd-ai-floating-btn" style="${ssrRenderStyle(btnStyle.value)}"${ssrRenderAttr("aria-label", `Ask ${label.value}`)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path></svg><span>Ask ${ssrInterpolate(label.value)}</span></button>`);
          }
        }, "body", false, _parent);
      } else {
        _push(`<!---->`);
      }
      _push(`<!--]-->`);
    };
  }
});
const _sfc_setup$8 = _sfc_main$8.setup;
_sfc_main$8.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../../node_modules/.pnpm/@farming-labs+nuxt-theme@0.0.19_nuxt@3.21.1_@parcel+watcher@2.5.6_@types+node@22.19.11_@verce_c2kauwg57ebbaat4wvbaomz2li/node_modules/@farming-labs/nuxt-theme/src/components/FloatingAIChat.vue");
  return _sfc_setup$8 ? _sfc_setup$8(props, ctx) : void 0;
};
const _sfc_main$7 = /* @__PURE__ */ defineComponent({
  __name: "ThemeToggle",
  __ssrInlineRender: true,
  setup(__props) {
    const theme = ref("light");
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<button${ssrRenderAttrs(mergeProps({
        class: "fd-theme-toggle",
        type: "button",
        "aria-label": "Toggle theme"
      }, _attrs))}>`);
      if (theme.value === "dark") {
        _push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`);
      } else {
        _push(`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`);
      }
      _push(`</button>`);
    };
  }
});
const _sfc_setup$7 = _sfc_main$7.setup;
_sfc_main$7.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../../node_modules/.pnpm/@farming-labs+nuxt-theme@0.0.19_nuxt@3.21.1_@parcel+watcher@2.5.6_@types+node@22.19.11_@verce_c2kauwg57ebbaat4wvbaomz2li/node_modules/@farming-labs/nuxt-theme/src/components/ThemeToggle.vue");
  return _sfc_setup$7 ? _sfc_setup$7(props, ctx) : void 0;
};
const _sfc_main$6 = /* @__PURE__ */ defineComponent({
  __name: "DocsLayout",
  __ssrInlineRender: true,
  props: {
    tree: {},
    config: { default: null },
    title: { default: void 0 },
    titleUrl: { default: void 0 },
    triggerComponent: { default: null }
  },
  setup(__props) {
    const props = __props;
    const route = useRoute();
    const resolvedTitle = computed(() => {
      var _a, _b, _c, _d;
      return (_d = (_c = props.title) != null ? _c : (_b = (_a = props.config) == null ? void 0 : _a.nav) == null ? void 0 : _b.title) != null ? _d : "Docs";
    });
    const resolvedTitleUrl = computed(() => {
      var _a, _b, _c, _d;
      return (_d = (_c = props.titleUrl) != null ? _c : (_b = (_a = props.config) == null ? void 0 : _a.nav) == null ? void 0 : _b.url) != null ? _d : "/docs";
    });
    const showThemeToggle = computed(() => {
      var _a;
      const toggle = (_a = props.config) == null ? void 0 : _a.themeToggle;
      if (toggle === void 0 || toggle === true) return true;
      if (toggle === false) return false;
      if (typeof toggle === "object") return toggle.enabled !== false;
      return true;
    });
    const forcedTheme = computed(() => {
      var _a;
      const toggle = (_a = props.config) == null ? void 0 : _a.themeToggle;
      if (typeof toggle === "object" && (toggle == null ? void 0 : toggle.enabled) === false && (toggle == null ? void 0 : toggle.default)) {
        return toggle.default;
      }
      return null;
    });
    const defaultTheme = computed(() => {
      var _a;
      const toggle = (_a = props.config) == null ? void 0 : _a.themeToggle;
      if (typeof toggle === "object" && (toggle == null ? void 0 : toggle.default)) return toggle.default;
      return null;
    });
    const themeInitScript = computed(() => {
      if (forcedTheme.value) {
        return `document.documentElement.classList.remove('light','dark');document.documentElement.classList.add('${forcedTheme.value}')`;
      }
      const def = defaultTheme.value;
      const fallback = def ? `'${def}'` : `(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light')`;
      return [
        "(function(){",
        "var m=document.cookie.match(/(?:^|;\\s*)theme=(\\w+)/);",
        `var t=m?m[1]:${fallback};`,
        "document.documentElement.classList.remove('light','dark');",
        "document.documentElement.classList.add(t);",
        "})()"
      ].join("");
    });
    const COLOR_MAP = {
      primary: "--color-fd-primary",
      primaryForeground: "--color-fd-primary-foreground",
      background: "--color-fd-background",
      foreground: "--color-fd-foreground",
      muted: "--color-fd-muted",
      mutedForeground: "--color-fd-muted-foreground",
      border: "--color-fd-border",
      card: "--color-fd-card",
      cardForeground: "--color-fd-card-foreground",
      accent: "--color-fd-accent",
      accentForeground: "--color-fd-accent-foreground",
      popover: "--color-fd-popover",
      popoverForeground: "--color-fd-popover-foreground",
      secondary: "--color-fd-secondary",
      secondaryForeground: "--color-fd-secondary-foreground",
      ring: "--color-fd-ring"
    };
    function buildColorsCSS(colors) {
      if (!colors) return "";
      const vars = [];
      for (const [key, value] of Object.entries(colors)) {
        if (!value || !COLOR_MAP[key]) continue;
        vars.push(`${COLOR_MAP[key]}: ${value};`);
      }
      if (vars.length === 0) return "";
      return `.dark {
  ${vars.join("\n  ")}
}`;
    }
    function buildFontStyleVars(prefix, style) {
      if (!style) return "";
      const parts = [];
      if (style.size) parts.push(`${prefix}-size: ${style.size};`);
      if (style.weight != null) parts.push(`${prefix}-weight: ${style.weight};`);
      if (style.lineHeight) parts.push(`${prefix}-line-height: ${style.lineHeight};`);
      if (style.letterSpacing) parts.push(`${prefix}-letter-spacing: ${style.letterSpacing};`);
      return parts.join("\n  ");
    }
    function buildTypographyCSS(typo) {
      if (!(typo == null ? void 0 : typo.font)) return "";
      const vars = [];
      const fontStyle = typo.font.style;
      if (fontStyle == null ? void 0 : fontStyle.sans) vars.push(`--fd-font-sans: ${fontStyle.sans};`);
      if (fontStyle == null ? void 0 : fontStyle.mono) vars.push(`--fd-font-mono: ${fontStyle.mono};`);
      for (const el of ["h1", "h2", "h3", "h4", "body", "small"]) {
        const elStyle = typo.font[el];
        if (elStyle) {
          const elVars = buildFontStyleVars(`--fd-${el}`, elStyle);
          if (elVars) vars.push(elVars);
        }
      }
      if (vars.length === 0) return "";
      return `:root {
  ${vars.join("\n  ")}
}`;
    }
    function buildLayoutCSS(layout) {
      if (!layout) return "";
      const rootVars = [];
      const desktopVars = [];
      if (layout.sidebarWidth) desktopVars.push(`--fd-sidebar-width: ${layout.sidebarWidth}px;`);
      if (layout.contentWidth) rootVars.push(`--fd-content-width: ${layout.contentWidth}px;`);
      if (layout.tocWidth) desktopVars.push(`--fd-toc-width: ${layout.tocWidth}px;`);
      if (rootVars.length === 0 && desktopVars.length === 0) return "";
      const parts = [];
      if (rootVars.length > 0) parts.push(`:root {
  ${rootVars.join("\n  ")}
}`);
      if (desktopVars.length > 0)
        parts.push(
          `@media (min-width: 1024px) {
  :root {
    ${desktopVars.join("\n    ")}
  }
}`
        );
      return parts.join("\n");
    }
    const overrideCSS = computed(() => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
      const colorOverrides = (_f = (_b = (_a = props.config) == null ? void 0 : _a.theme) == null ? void 0 : _b._userColorOverrides) != null ? _f : (_e = (_d = (_c = props.config) == null ? void 0 : _c.theme) == null ? void 0 : _d.ui) == null ? void 0 : _e.colors;
      const typography = (_i = (_h = (_g = props.config) == null ? void 0 : _g.theme) == null ? void 0 : _h.ui) == null ? void 0 : _i.typography;
      const layout = (_l = (_k = (_j = props.config) == null ? void 0 : _j.theme) == null ? void 0 : _k.ui) == null ? void 0 : _l.layout;
      return [buildColorsCSS(colorOverrides), buildTypographyCSS(typography), buildLayoutCSS(layout)].filter(Boolean).join("\n");
    });
    useHead(() => ({
      script: [{ innerHTML: themeInitScript.value, tagPosition: "head" }],
      style: overrideCSS.value ? [{ innerHTML: overrideCSS.value }] : []
    }));
    const sidebarOpen = ref(false);
    const searchOpen = ref(false);
    function closeSidebar() {
      sidebarOpen.value = false;
    }
    function closeSearch() {
      searchOpen.value = false;
    }
    function isActive(url) {
      const current = route.path;
      const normalised = (url != null ? url : "").replace(/\/$/, "") || "/";
      const currentNorm = current.replace(/\/$/, "") || "/";
      return normalised === currentNorm;
    }
    const ICON_MAP = {
      book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      terminal: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
      code: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
      folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
      rocket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>',
      settings: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>'
    };
    function getIcon(iconKey) {
      var _a;
      if (!iconKey) return null;
      return (_a = ICON_MAP[iconKey]) != null ? _a : null;
    }
    const showFloatingAI = computed(
      () => {
        var _a, _b, _c, _d;
        return ((_b = (_a = props.config) == null ? void 0 : _a.ai) == null ? void 0 : _b.enabled) && ((_d = (_c = props.config) == null ? void 0 : _c.ai) == null ? void 0 : _d.mode) === "floating";
      }
    );
    return (_ctx, _push, _parent, _attrs) => {
      var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
      const _component_NuxtLink = __nuxt_component_0;
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "fd-layout-root" }, _attrs))}><div class="fd-layout"><header class="fd-header"><button class="fd-menu-btn" type="button" aria-label="Toggle sidebar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg></button>`);
      _push(ssrRenderComponent(_component_NuxtLink, {
        to: resolvedTitleUrl.value,
        class: "fd-header-title"
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`${ssrInterpolate(resolvedTitle.value)}`);
          } else {
            return [
              createTextVNode(toDisplayString(resolvedTitle.value), 1)
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`<button class="fd-search-trigger-mobile" type="button" aria-label="Search"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg></button></header>`);
      if (sidebarOpen.value) {
        _push(`<div class="fd-sidebar-overlay" aria-hidden="true"></div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<aside class="${ssrRenderClass([{ "fd-sidebar-open": sidebarOpen.value }, "fd-sidebar"])}"><div class="fd-sidebar-header">`);
      _push(ssrRenderComponent(_component_NuxtLink, {
        to: resolvedTitleUrl.value,
        class: "fd-sidebar-title",
        onClick: closeSidebar
      }, {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          if (_push2) {
            _push2(`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"${_scopeId}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"${_scopeId}></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"${_scopeId}></path></svg> ${ssrInterpolate(resolvedTitle.value)}`);
          } else {
            return [
              (openBlock(), createBlock("svg", {
                width: "18",
                height: "18",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "currentColor",
                "stroke-width": "2"
              }, [
                createVNode("path", { d: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20" }),
                createVNode("path", { d: "M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" })
              ])),
              createTextVNode(" " + toDisplayString(resolvedTitle.value), 1)
            ];
          }
        }),
        _: 1
      }, _parent));
      _push(`</div><div class="fd-sidebar-search"><button type="button" class="fd-sidebar-search-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg><span>Search</span><kbd>\u2318</kbd><kbd>K</kbd></button></div>`);
      if (_ctx.$slots["sidebar-header"]) {
        _push(`<div class="fd-sidebar-banner">`);
        ssrRenderSlot(_ctx.$slots, "sidebar-header", {}, null, _push, _parent);
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`<nav class="fd-sidebar-nav">`);
      ssrRenderSlot(_ctx.$slots, "sidebar", {
        tree: __props.tree,
        isActive
      }, () => {
        var _a2;
        if ((_a2 = __props.tree) == null ? void 0 : _a2.children) {
          _push(`<!--[-->`);
          ssrRenderList(__props.tree.children, (node, i) => {
            var _a3, _b2;
            _push(`<!--[-->`);
            if (node.type === "page") {
              _push(ssrRenderComponent(_component_NuxtLink, {
                to: node.url,
                class: ["fd-sidebar-link fd-sidebar-top-link", {
                  "fd-sidebar-link-active": isActive((_a3 = node.url) != null ? _a3 : ""),
                  "fd-sidebar-first-item": i === 0
                }],
                onClick: closeSidebar
              }, {
                default: withCtx((_, _push2, _parent2, _scopeId) => {
                  var _a4;
                  if (_push2) {
                    if (getIcon(node.icon)) {
                      _push2(`<span class="fd-sidebar-icon"${_scopeId}>${(_a4 = getIcon(node.icon)) != null ? _a4 : ""}</span>`);
                    } else {
                      _push2(`<!---->`);
                    }
                    _push2(` ${ssrInterpolate(node.name)}`);
                  } else {
                    return [
                      getIcon(node.icon) ? (openBlock(), createBlock("span", {
                        key: 0,
                        class: "fd-sidebar-icon",
                        innerHTML: getIcon(node.icon)
                      }, null, 8, ["innerHTML"])) : createCommentVNode("", true),
                      createTextVNode(" " + toDisplayString(node.name), 1)
                    ];
                  }
                }),
                _: 2
              }, _parent));
            } else if (node.type === "folder") {
              _push(`<details class="${ssrRenderClass([{ "fd-sidebar-first-item": i === 0 }, "fd-sidebar-folder"])}" open><summary class="fd-sidebar-folder-trigger"><span class="fd-sidebar-folder-label">`);
              if (getIcon(node.icon)) {
                _push(`<span class="fd-sidebar-icon">${(_b2 = getIcon(node.icon)) != null ? _b2 : ""}</span>`);
              } else {
                _push(`<!---->`);
              }
              _push(` ${ssrInterpolate(node.name)}</span><svg class="fd-sidebar-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></summary><div class="fd-sidebar-folder-content">`);
              if (node.index) {
                _push(ssrRenderComponent(_component_NuxtLink, {
                  to: node.index.url,
                  class: ["fd-sidebar-link fd-sidebar-child-link", { "fd-sidebar-link-active": isActive(node.index.url) }],
                  onClick: closeSidebar
                }, {
                  default: withCtx((_, _push2, _parent2, _scopeId) => {
                    if (_push2) {
                      _push2(`${ssrInterpolate(node.index.name)}`);
                    } else {
                      return [
                        createTextVNode(toDisplayString(node.index.name), 1)
                      ];
                    }
                  }),
                  _: 2
                }, _parent));
              } else {
                _push(`<!---->`);
              }
              _push(`<!--[-->`);
              ssrRenderList(node.children, (child) => {
                _push(`<!--[-->`);
                if (child.type === "page") {
                  _push(ssrRenderComponent(_component_NuxtLink, {
                    to: child.url,
                    class: ["fd-sidebar-link fd-sidebar-child-link", { "fd-sidebar-link-active": isActive(child.url) }],
                    onClick: closeSidebar
                  }, {
                    default: withCtx((_, _push2, _parent2, _scopeId) => {
                      if (_push2) {
                        _push2(`${ssrInterpolate(child.name)}`);
                      } else {
                        return [
                          createTextVNode(toDisplayString(child.name), 1)
                        ];
                      }
                    }),
                    _: 2
                  }, _parent));
                } else if (child.type === "folder") {
                  _push(`<details class="fd-sidebar-folder fd-sidebar-nested-folder" open><summary class="fd-sidebar-folder-trigger"><span class="fd-sidebar-folder-label">${ssrInterpolate(child.name)}</span><svg class="fd-sidebar-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg></summary><div class="fd-sidebar-folder-content">`);
                  if (child.index) {
                    _push(ssrRenderComponent(_component_NuxtLink, {
                      to: child.index.url,
                      class: ["fd-sidebar-link fd-sidebar-child-link", { "fd-sidebar-link-active": isActive(child.index.url) }],
                      onClick: closeSidebar
                    }, {
                      default: withCtx((_, _push2, _parent2, _scopeId) => {
                        if (_push2) {
                          _push2(`${ssrInterpolate(child.index.name)}`);
                        } else {
                          return [
                            createTextVNode(toDisplayString(child.index.name), 1)
                          ];
                        }
                      }),
                      _: 2
                    }, _parent));
                  } else {
                    _push(`<!---->`);
                  }
                  if (_ctx.grandchild.type === "page") {
                    _push(`<!--[-->`);
                    ssrRenderList(child.children, (grandchild) => {
                      _push(ssrRenderComponent(_component_NuxtLink, {
                        key: grandchild.url,
                        to: grandchild.url,
                        class: ["fd-sidebar-link fd-sidebar-child-link", { "fd-sidebar-link-active": isActive(grandchild.url) }],
                        onClick: closeSidebar
                      }, {
                        default: withCtx((_, _push2, _parent2, _scopeId) => {
                          if (_push2) {
                            _push2(`${ssrInterpolate(grandchild.name)}`);
                          } else {
                            return [
                              createTextVNode(toDisplayString(grandchild.name), 1)
                            ];
                          }
                        }),
                        _: 2
                      }, _parent));
                    });
                    _push(`<!--]-->`);
                  } else {
                    _push(`<!---->`);
                  }
                  _push(`</div></details>`);
                } else {
                  _push(`<!---->`);
                }
                _push(`<!--]-->`);
              });
              _push(`<!--]--></div></details>`);
            } else {
              _push(`<!---->`);
            }
            _push(`<!--]-->`);
          });
          _push(`<!--]-->`);
        } else {
          _push(`<!---->`);
        }
      }, _push, _parent);
      _push(`</nav>`);
      if (_ctx.$slots["sidebar-footer"]) {
        _push(`<div class="fd-sidebar-footer-custom">`);
        ssrRenderSlot(_ctx.$slots, "sidebar-footer", {}, null, _push, _parent);
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      if (showThemeToggle.value) {
        _push(`<div class="fd-sidebar-footer">`);
        _push(ssrRenderComponent(_sfc_main$7, null, null, _parent));
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</aside><main class="fd-main">`);
      ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
      _push(`</main></div>`);
      if (showFloatingAI.value) {
        _push(ssrRenderComponent(_sfc_main$8, {
          api: "/api/docs",
          "suggested-questions": (_c = (_b = (_a = __props.config) == null ? void 0 : _a.ai) == null ? void 0 : _b.suggestedQuestions) != null ? _c : [],
          "ai-label": (_f = (_e = (_d = __props.config) == null ? void 0 : _d.ai) == null ? void 0 : _e.aiLabel) != null ? _f : "AI",
          position: (_i = (_h = (_g = __props.config) == null ? void 0 : _g.ai) == null ? void 0 : _h.position) != null ? _i : "bottom-right",
          "floating-style": (_l = (_k = (_j = __props.config) == null ? void 0 : _j.ai) == null ? void 0 : _k.floatingStyle) != null ? _l : "panel",
          "trigger-component": __props.triggerComponent
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      if (searchOpen.value) {
        _push(ssrRenderComponent(_sfc_main$9, { onClose: closeSearch }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$6 = _sfc_main$6.setup;
_sfc_main$6.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../../node_modules/.pnpm/@farming-labs+nuxt-theme@0.0.19_nuxt@3.21.1_@parcel+watcher@2.5.6_@types+node@22.19.11_@verce_c2kauwg57ebbaat4wvbaomz2li/node_modules/@farming-labs/nuxt-theme/src/components/DocsLayout.vue");
  return _sfc_setup$6 ? _sfc_setup$6(props, ctx) : void 0;
};
const _sfc_main$5 = /* @__PURE__ */ defineComponent({
  __name: "Breadcrumb",
  __ssrInlineRender: true,
  props: {
    pathname: { default: "" },
    entry: { default: "docs" }
  },
  setup(__props) {
    const props = __props;
    const segments = computed(() => {
      return props.pathname.split("/").filter(Boolean);
    });
    const parentLabel = computed(() => {
      if (segments.value.length < 2) return "";
      return segments.value[segments.value.length - 2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    });
    const currentLabel = computed(() => {
      if (segments.value.length < 2) return "";
      return segments.value[segments.value.length - 1].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    });
    const parentUrl = computed(() => {
      if (segments.value.length < 2) return "";
      return "/" + segments.value.slice(0, segments.value.length - 1).join("/");
    });
    return (_ctx, _push, _parent, _attrs) => {
      if (segments.value.length >= 2) {
        _push(`<nav${ssrRenderAttrs(mergeProps({
          class: "fd-breadcrumb",
          "aria-label": "Breadcrumb"
        }, _attrs))}><span class="fd-breadcrumb-item"><a${ssrRenderAttr("href", parentUrl.value)} class="fd-breadcrumb-parent fd-breadcrumb-link">${ssrInterpolate(parentLabel.value)}</a></span><span class="fd-breadcrumb-item"><span class="fd-breadcrumb-sep">/</span><span class="fd-breadcrumb-current">${ssrInterpolate(currentLabel.value)}</span></span></nav>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
});
const _sfc_setup$5 = _sfc_main$5.setup;
_sfc_main$5.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../../node_modules/.pnpm/@farming-labs+nuxt-theme@0.0.19_nuxt@3.21.1_@parcel+watcher@2.5.6_@types+node@22.19.11_@verce_c2kauwg57ebbaat4wvbaomz2li/node_modules/@farming-labs/nuxt-theme/src/components/Breadcrumb.vue");
  return _sfc_setup$5 ? _sfc_setup$5(props, ctx) : void 0;
};
const ACTIVE_ZONE_TOP = 120;
const HYSTERESIS_PX = 65;
const _sfc_main$4 = /* @__PURE__ */ defineComponent({
  __name: "TableOfContents",
  __ssrInlineRender: true,
  props: {
    items: {},
    tocStyle: {}
  },
  setup(__props) {
    const props = __props;
    const items = computed(() => {
      var _a;
      return (_a = props.items) != null ? _a : [];
    });
    const isDirectional = computed(() => props.tocStyle === "directional");
    const activeIds = ref(/* @__PURE__ */ new Set());
    const listRef = ref(null);
    const containerRef = ref(null);
    const thumbTop = ref(0);
    const thumbHeight = ref(0);
    const svgPath = ref("");
    let lastStableId = null;
    function getDistanceToZone(id) {
      const el = (void 0).getElementById(id);
      if (!el) return Infinity;
      const rect = el.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      return Math.abs(mid - ACTIVE_ZONE_TOP);
    }
    function getClosestId() {
      const ids = items.value.map((item) => item.url.slice(1));
      let bestId = null;
      let bestDistance = Infinity;
      for (const id of ids) {
        const d = getDistanceToZone(id);
        if (d < bestDistance) {
          bestDistance = d;
          bestId = id;
        }
      }
      return bestId;
    }
    function isInView(id) {
      const el = (void 0).getElementById(id);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      return rect.top < (void 0).innerHeight && rect.bottom > 0;
    }
    function getActiveIdFromScroll() {
      const newId = getClosestId();
      if (!newId) return /* @__PURE__ */ new Set();
      if (lastStableId === null) {
        lastStableId = newId;
        return /* @__PURE__ */ new Set([newId]);
      }
      if (newId === lastStableId) return /* @__PURE__ */ new Set([newId]);
      const newDist = getDistanceToZone(newId);
      const currentDist = getDistanceToZone(lastStableId);
      const switchToNew = newDist <= currentDist - HYSTERESIS_PX || !isInView(lastStableId);
      if (switchToNew) lastStableId = newId;
      return /* @__PURE__ */ new Set([lastStableId]);
    }
    function getItemOffset(depth) {
      if (depth <= 2) return 14;
      if (depth === 3) return 26;
      return 36;
    }
    function getLineOffset(depth) {
      return depth >= 3 ? 10 : 0;
    }
    function isActive(item) {
      return activeIds.value.has(item.url.slice(1));
    }
    function defaultLinkStyle(item) {
      const indent = (item.depth - 2) * 12;
      return { paddingLeft: `${12 + indent}px` };
    }
    function clerkLinkStyle(item) {
      return {
        position: "relative",
        paddingLeft: `${getItemOffset(item.depth)}px`,
        paddingTop: "6px",
        paddingBottom: "6px",
        fontSize: item.depth <= 2 ? "14px" : "13px"
      };
    }
    function verticalLineStyle(item, index) {
      const list = items.value;
      const prevDepth = index > 0 ? list[index - 1].depth : item.depth;
      const nextDepth = index < list.length - 1 ? list[index + 1].depth : item.depth;
      const depthChanged = prevDepth !== item.depth;
      const depthChangesNext = nextDepth !== item.depth;
      return {
        position: "absolute",
        left: `${getLineOffset(item.depth)}px`,
        top: depthChanged ? "6px" : "0",
        bottom: depthChangesNext ? "6px" : "0",
        width: "1px",
        background: "hsla(0, 0%, 50%, 0.1)"
      };
    }
    function hasDiagonal(index) {
      if (index === 0) return false;
      const list = items.value;
      return list[index - 1].depth !== list[index].depth;
    }
    function diagonalSvg(index) {
      const list = items.value;
      const prevDepth = list[index - 1].depth;
      const currDepth = list[index].depth;
      const upperOffset = getLineOffset(prevDepth);
      const currentOffset = getLineOffset(currDepth);
      return { upperOffset, currentOffset };
    }
    function buildSvgPath() {
      if (!listRef.value) return;
      const links = listRef.value.querySelectorAll(".fd-toc-clerk-link");
      if (links.length === 0) {
        svgPath.value = "";
        return;
      }
      const containerTop = listRef.value.offsetTop;
      let d = "";
      const list = items.value;
      links.forEach((el, i) => {
        if (i >= list.length) return;
        const depth = list[i].depth;
        const x = getLineOffset(depth) + 1;
        const top = el.offsetTop - containerTop;
        const bottom = top + el.clientHeight;
        const cmd = i === 0 ? "M" : "L";
        d += `${cmd}${x} ${top} L${x} ${bottom} `;
      });
      svgPath.value = d.trim();
    }
    function calcThumb() {
      if (!listRef.value || activeIds.value.size === 0) {
        thumbTop.value = 0;
        thumbHeight.value = 0;
        return;
      }
      const containerTop = listRef.value.offsetTop;
      let upper = Infinity;
      let lower = 0;
      for (const id of activeIds.value) {
        const el = listRef.value.querySelector(`a[href="#${id}"]`);
        if (!el) continue;
        const styles = getComputedStyle(el);
        const elTop = el.offsetTop - containerTop;
        upper = Math.min(upper, elTop + parseFloat(styles.paddingTop));
        lower = Math.max(lower, elTop + el.clientHeight - parseFloat(styles.paddingBottom));
      }
      if (upper === Infinity) {
        thumbTop.value = 0;
        thumbHeight.value = 0;
        return;
      }
      thumbTop.value = upper;
      thumbHeight.value = lower - upper;
    }
    function maskSvgUrl() {
      if (!svgPath.value) return "none";
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><path d="${svgPath.value}" stroke="white" stroke-width="2" fill="none"/></svg>`;
      return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    }
    watch(
      items,
      () => {
        lastStableId = null;
        nextTick(() => {
          activeIds.value = getActiveIdFromScroll();
          if (isDirectional.value) {
            buildSvgPath();
            calcThumb();
          }
        });
      },
      { flush: "post" }
    );
    watch(
      activeIds,
      () => {
        if (isDirectional.value) {
          calcThumb();
        }
      },
      { deep: true }
    );
    watch(isDirectional, (val) => {
      if (val) {
        nextTick(() => {
          buildSvgPath();
          calcThumb();
        });
      }
    });
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<div${ssrRenderAttrs(mergeProps({
        ref_key: "containerRef",
        ref: containerRef,
        class: ["fd-toc-inner", { "fd-toc-directional": isDirectional.value }]
      }, _attrs))}><h3 class="fd-toc-title"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="15" y2="12"></line><line x1="3" y1="18" x2="18" y2="18"></line></svg> On this page </h3>`);
      if (items.value.length === 0) {
        _push(`<p class="fd-toc-empty">No Headings</p>`);
      } else if (!isDirectional.value) {
        _push(`<ul class="fd-toc-list"><!--[-->`);
        ssrRenderList(items.value, (item) => {
          _push(`<li class="fd-toc-item"><a${ssrRenderAttr("href", item.url)} class="${ssrRenderClass([{ "fd-toc-link-active": isActive(item) }, "fd-toc-link"])}" style="${ssrRenderStyle(defaultLinkStyle(item))}">${ssrInterpolate(item.title)}</a></li>`);
        });
        _push(`<!--]--></ul>`);
      } else {
        _push(`<div class="fd-toc-clerk-wrap" style="${ssrRenderStyle({ "position": "relative" })}"><ul class="fd-toc-list fd-toc-clerk"><!--[-->`);
        ssrRenderList(items.value, (item, index) => {
          _push(`<li class="fd-toc-item"><a${ssrRenderAttr("href", item.url)} class="fd-toc-link fd-toc-clerk-link" style="${ssrRenderStyle(clerkLinkStyle(item))}"${ssrRenderAttr("data-active", isActive(item) || void 0)}><div style="${ssrRenderStyle(verticalLineStyle(item, index))}"></div>`);
          if (hasDiagonal(index)) {
            _push(`<svg viewBox="0 0 16 16" width="16" height="16" style="${ssrRenderStyle({ "position": "absolute", "top": "-6px", "left": "0" })}"><line${ssrRenderAttr("x1", diagonalSvg(index).upperOffset)} y1="0"${ssrRenderAttr("x2", diagonalSvg(index).currentOffset)} y2="12" stroke="hsla(0, 0%, 50%, 0.1)" stroke-width="1"></line></svg>`);
          } else {
            _push(`<!---->`);
          }
          _push(` ${ssrInterpolate(item.title)}</a></li>`);
        });
        _push(`<!--]--></ul>`);
        if (svgPath.value) {
          _push(`<div class="fd-toc-clerk-mask" style="${ssrRenderStyle({
            position: "absolute",
            left: "0",
            top: "0",
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            maskImage: maskSvgUrl(),
            WebkitMaskImage: maskSvgUrl(),
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat"
          })}"><div class="fd-toc-clerk-thumb" style="${ssrRenderStyle({
            marginTop: `${thumbTop.value}px`,
            height: `${thumbHeight.value}px`,
            background: "var(--color-fd-primary)",
            transition: "all 0.15s"
          })}"></div></div>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$4 = _sfc_main$4.setup;
_sfc_main$4.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../../node_modules/.pnpm/@farming-labs+nuxt-theme@0.0.19_nuxt@3.21.1_@parcel+watcher@2.5.6_@types+node@22.19.11_@verce_c2kauwg57ebbaat4wvbaomz2li/node_modules/@farming-labs/nuxt-theme/src/components/TableOfContents.vue");
  return _sfc_setup$4 ? _sfc_setup$4(props, ctx) : void 0;
};
const _sfc_main$3 = /* @__PURE__ */ defineComponent({
  __name: "DocsPage",
  __ssrInlineRender: true,
  props: {
    tocEnabled: { type: Boolean, default: true },
    tocStyle: { default: "default" },
    breadcrumbEnabled: { type: Boolean, default: true },
    entry: { default: "docs" },
    previousPage: { default: null },
    nextPage: { default: null },
    editOnGithub: { default: null },
    lastModified: { default: null },
    llmsTxtEnabled: { type: Boolean, default: false }
  },
  setup(__props) {
    const route = useRoute();
    const tocItems = ref([]);
    function scanHeadings() {
      requestAnimationFrame(() => {
        const container = (void 0).querySelector(".fd-page-body");
        if (!container) return;
        const headings = container.querySelectorAll("h2[id], h3[id], h4[id]");
        tocItems.value = Array.from(headings).map((el) => {
          var _a;
          return {
            title: ((_a = el.textContent) != null ? _a : "").replace(/^#\s*/, ""),
            url: `#${el.id}`,
            depth: parseInt(el.tagName[1], 10)
          };
        });
      });
    }
    function wireInteractive() {
      requestAnimationFrame(() => {
        (void 0).querySelectorAll(".fd-copy-btn").forEach((btn) => {
          btn.addEventListener("click", () => {
            var _a, _b, _c, _d, _e;
            const code = (_a = btn.getAttribute("data-code")) == null ? void 0 : _a.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
            if (!code) return;
            const block = btn.closest(".fd-codeblock");
            (_d = (_c = (_b = block == null ? void 0 : block.querySelector(".fd-codeblock-title-text")) == null ? void 0 : _b.textContent) == null ? void 0 : _c.trim()) != null ? _d : void 0;
            (_e = block == null ? void 0 : block.getAttribute("data-language")) != null ? _e : void 0;
            (void 0).clipboard.writeText(code).then(() => {
              try {
                if (false) ;
                if (false) ;
              } catch (_) {
              }
              btn.classList.add("fd-copy-btn-copied");
              btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
              setTimeout(() => {
                btn.classList.remove("fd-copy-btn-copied");
                btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
              }, 2e3);
            });
          });
        });
        (void 0).querySelectorAll("[data-tabs]").forEach((tabs) => {
          tabs.querySelectorAll(".fd-tab-trigger").forEach((trigger) => {
            trigger.addEventListener("click", () => {
              const val = trigger.getAttribute("data-tab-value");
              tabs.querySelectorAll(".fd-tab-trigger").forEach((t) => {
                t.classList.toggle("fd-tab-active", t.getAttribute("data-tab-value") === val);
                t.setAttribute("aria-selected", String(t.getAttribute("data-tab-value") === val));
              });
              tabs.querySelectorAll(".fd-tab-panel").forEach((p) => {
                p.classList.toggle("fd-tab-panel-active", p.getAttribute("data-tab-panel") === val);
              });
            });
          });
        });
      });
    }
    watch(
      () => route.path,
      () => {
        scanHeadings();
        wireInteractive();
      }
    );
    return (_ctx, _push, _parent, _attrs) => {
      const _component_NuxtLink = __nuxt_component_0;
      _push(`<div${ssrRenderAttrs(mergeProps({ class: "fd-page" }, _attrs))}><article class="fd-page-article" id="nd-page">`);
      if (__props.breadcrumbEnabled) {
        _push(ssrRenderComponent(_sfc_main$5, {
          pathname: unref(route).path,
          entry: __props.entry
        }, null, _parent));
      } else {
        _push(`<!---->`);
      }
      _push(`<div class="fd-page-body"><div class="fd-docs-content">`);
      ssrRenderSlot(_ctx.$slots, "default", {}, null, _push, _parent);
      _push(`</div></div><footer class="fd-page-footer">`);
      if (__props.editOnGithub || __props.lastModified || __props.llmsTxtEnabled) {
        _push(`<div class="fd-edit-on-github">`);
        if (__props.editOnGithub) {
          _push(`<a${ssrRenderAttr("href", __props.editOnGithub)} target="_blank" rel="noopener noreferrer"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Edit on GitHub </a>`);
        } else {
          _push(`<!---->`);
        }
        if (__props.llmsTxtEnabled) {
          _push(`<span class="fd-llms-txt-links"><a href="/api/docs?format=llms" target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms.txt</a><a href="/api/docs?format=llms-full" target="_blank" rel="noopener noreferrer" class="fd-llms-txt-link">llms-full.txt</a></span>`);
        } else {
          _push(`<!---->`);
        }
        if (__props.lastModified) {
          _push(`<span class="fd-last-modified">Last updated: ${ssrInterpolate(__props.lastModified)}</span>`);
        } else {
          _push(`<!---->`);
        }
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
      if (__props.previousPage || __props.nextPage) {
        _push(`<nav class="fd-page-nav" aria-label="Page navigation">`);
        if (__props.previousPage) {
          _push(ssrRenderComponent(_component_NuxtLink, {
            to: __props.previousPage.url,
            class: "fd-page-nav-card fd-page-nav-prev"
          }, {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                _push2(`<span class="fd-page-nav-label"${_scopeId}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${_scopeId}><polyline points="15 18 9 12 15 6"${_scopeId}></polyline></svg> Previous </span><span class="fd-page-nav-title"${_scopeId}>${ssrInterpolate(__props.previousPage.name)}</span>`);
              } else {
                return [
                  createVNode("span", { class: "fd-page-nav-label" }, [
                    (openBlock(), createBlock("svg", {
                      width: "14",
                      height: "14",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      "stroke-width": "2",
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round"
                    }, [
                      createVNode("polyline", { points: "15 18 9 12 15 6" })
                    ])),
                    createTextVNode(" Previous ")
                  ]),
                  createVNode("span", { class: "fd-page-nav-title" }, toDisplayString(__props.previousPage.name), 1)
                ];
              }
            }),
            _: 1
          }, _parent));
        } else {
          _push(`<div></div>`);
        }
        if (__props.nextPage) {
          _push(ssrRenderComponent(_component_NuxtLink, {
            to: __props.nextPage.url,
            class: "fd-page-nav-card fd-page-nav-next"
          }, {
            default: withCtx((_, _push2, _parent2, _scopeId) => {
              if (_push2) {
                _push2(`<span class="fd-page-nav-label"${_scopeId}> Next <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${_scopeId}><polyline points="9 18 15 12 9 6"${_scopeId}></polyline></svg></span><span class="fd-page-nav-title"${_scopeId}>${ssrInterpolate(__props.nextPage.name)}</span>`);
              } else {
                return [
                  createVNode("span", { class: "fd-page-nav-label" }, [
                    createTextVNode(" Next "),
                    (openBlock(), createBlock("svg", {
                      width: "14",
                      height: "14",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      "stroke-width": "2",
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round"
                    }, [
                      createVNode("polyline", { points: "9 18 15 12 9 6" })
                    ]))
                  ]),
                  createVNode("span", { class: "fd-page-nav-title" }, toDisplayString(__props.nextPage.name), 1)
                ];
              }
            }),
            _: 1
          }, _parent));
        } else {
          _push(`<div></div>`);
        }
        _push(`</nav>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</footer></article>`);
      if (__props.tocEnabled) {
        _push(`<aside class="fd-toc">`);
        _push(ssrRenderComponent(_sfc_main$4, {
          items: tocItems.value,
          "toc-style": __props.tocStyle
        }, null, _parent));
        _push(`</aside>`);
      } else {
        _push(`<!---->`);
      }
      _push(`</div>`);
    };
  }
});
const _sfc_setup$3 = _sfc_main$3.setup;
_sfc_main$3.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../../node_modules/.pnpm/@farming-labs+nuxt-theme@0.0.19_nuxt@3.21.1_@parcel+watcher@2.5.6_@types+node@22.19.11_@verce_c2kauwg57ebbaat4wvbaomz2li/node_modules/@farming-labs/nuxt-theme/src/components/DocsPage.vue");
  return _sfc_setup$3 ? _sfc_setup$3(props, ctx) : void 0;
};
const _sfc_main$2 = /* @__PURE__ */ defineComponent({
  __name: "DocsContent",
  __ssrInlineRender: true,
  props: {
    data: {},
    config: {}
  },
  setup(__props) {
    const DEFAULT_OPEN_PROVIDERS = [
      { name: "ChatGPT", urlTemplate: "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it." },
      { name: "Claude", urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it." }
    ];
    const props = __props;
    const route = useRoute();
    const openDropdownMenu = ref(false);
    const copyLabel = ref("Copy page");
    const copied = ref(false);
    const titleSuffix = computed(
      () => {
        var _a, _b;
        return ((_b = (_a = props.config) == null ? void 0 : _a.metadata) == null ? void 0 : _b.titleTemplate) ? String(props.config.metadata.titleTemplate).replace("%s", "") : " \u2013 Docs";
      }
    );
    const themeUi = computed(() => {
      var _a, _b;
      return (_b = (_a = props.config) == null ? void 0 : _a.theme) == null ? void 0 : _b.ui;
    });
    const layout = computed(() => {
      var _a;
      return (_a = themeUi.value) == null ? void 0 : _a.layout;
    });
    const tocConfig = computed(() => {
      var _a;
      return (_a = layout.value) == null ? void 0 : _a.toc;
    });
    const tocEnabledVal = computed(() => {
      var _a, _b;
      return (_b = (_a = tocConfig.value) == null ? void 0 : _a.enabled) != null ? _b : true;
    });
    const tocStyleVal = computed(() => {
      var _a;
      const style = (_a = tocConfig.value) == null ? void 0 : _a.style;
      return style === "directional" ? "directional" : "default";
    });
    const breadcrumbEnabled = computed(() => {
      var _a;
      const bc = (_a = props.config) == null ? void 0 : _a.breadcrumb;
      if (bc === void 0 || bc === true) return true;
      if (bc === false) return false;
      if (typeof bc === "object") return bc.enabled !== false;
      return true;
    });
    const showEditOnGithub = computed(() => {
      var _a;
      return !!((_a = props.config) == null ? void 0 : _a.github) && !!props.data.editOnGithub;
    });
    computed(() => !!props.data.lastModified);
    const llmsTxtEnabled = computed(() => {
      var _a;
      const cfg = (_a = props.config) == null ? void 0 : _a.llmsTxt;
      if (cfg === true) return true;
      if (typeof cfg === "object" && cfg !== null) return cfg.enabled !== false;
      return false;
    });
    const entry = computed(() => {
      var _a, _b;
      return (_b = (_a = props.config) == null ? void 0 : _a.entry) != null ? _b : "docs";
    });
    const copyMarkdownEnabled = computed(() => {
      var _a;
      const pa = (_a = props.config) == null ? void 0 : _a.pageActions;
      if (!pa) return false;
      const cm = pa.copyMarkdown;
      if (cm === true) return true;
      if (typeof cm === "object" && cm !== null) return cm.enabled !== false;
      return false;
    });
    const openDocsEnabled = computed(() => {
      var _a;
      const pa = (_a = props.config) == null ? void 0 : _a.pageActions;
      if (!pa) return false;
      const od = pa.openDocs;
      if (od === true) return true;
      if (typeof od === "object" && od !== null) return od.enabled !== false;
      return false;
    });
    const openDocsProviders = computed(() => {
      var _a;
      const pa = (_a = props.config) == null ? void 0 : _a.pageActions;
      const od = pa && typeof pa === "object" && pa.openDocs != null ? pa.openDocs : null;
      const list = od && typeof od === "object" && "providers" in od ? od.providers : void 0;
      if (Array.isArray(list) && list.length > 0) {
        const mapped = list.map((p) => ({
          name: typeof (p == null ? void 0 : p.name) === "string" ? p.name : "Open",
          urlTemplate: typeof (p == null ? void 0 : p.urlTemplate) === "string" ? p.urlTemplate : ""
        })).filter((p) => p.urlTemplate.length > 0);
        if (mapped.length > 0) return mapped;
      }
      return DEFAULT_OPEN_PROVIDERS;
    });
    const pageActionsPosition = computed(() => {
      var _a;
      const pa = (_a = props.config) == null ? void 0 : _a.pageActions;
      if (typeof pa === "object" && pa !== null && pa.position) return pa.position;
      return "below-title";
    });
    const pageActionsAlignment = computed(() => {
      var _a;
      const pa = (_a = props.config) == null ? void 0 : _a.pageActions;
      if (typeof pa === "object" && pa !== null && pa.alignment) return pa.alignment;
      return "left";
    });
    const lastUpdatedConfig = computed(() => {
      var _a, _b;
      const lu = (_a = props.config) == null ? void 0 : _a.lastUpdated;
      if (lu === false) return { enabled: false, position: "footer" };
      if (lu === true || lu === void 0) return { enabled: true, position: "footer" };
      const o = lu;
      return {
        enabled: o.enabled !== false,
        position: (_b = o.position) != null ? _b : "footer"
      };
    });
    const showLastUpdatedInFooter = computed(
      () => !!props.data.lastModified && lastUpdatedConfig.value.enabled && lastUpdatedConfig.value.position === "footer"
    );
    const showLastUpdatedBelowTitle = computed(
      () => !!props.data.lastModified && lastUpdatedConfig.value.enabled && lastUpdatedConfig.value.position === "below-title"
    );
    const htmlWithoutFirstH1 = computed(() => {
      const html = props.data.html || "";
      return html.replace(/<h1[^>]*>[\s\S]*?<\/h1>\s*/i, "");
    });
    const metaDescription = computed(
      () => {
        var _a, _b, _c, _d;
        return (_d = (_c = props.data.description) != null ? _c : (_b = (_a = props.config) == null ? void 0 : _a.metadata) == null ? void 0 : _b.description) != null ? _d : void 0;
      }
    );
    const showPageActions = computed(
      () => (copyMarkdownEnabled.value || openDocsEnabled.value) && openDocsProviders.value.length >= 0
    );
    const showActionsAbove = computed(() => pageActionsPosition.value === "above-title" && showPageActions.value);
    const showActionsBelow = computed(() => pageActionsPosition.value === "below-title" && showPageActions.value);
    useHead({
      title: () => `${props.data.title}${titleSuffix.value}`,
      meta: () => metaDescription.value ? [{ name: "description", content: metaDescription.value }] : []
    });
    function handleCopyPage() {
      let text = "";
      const raw = props.data.rawMarkdown;
      if (raw && typeof raw === "string" && raw.length > 0) {
        text = raw;
      } else {
        const article = (void 0).querySelector("#nd-page");
        if (article) text = article.innerText || "";
      }
      if (!text) return;
      (void 0).clipboard.writeText(text).then(
        () => {
          copyLabel.value = "Copied!";
          copied.value = true;
          setTimeout(() => {
            copyLabel.value = "Copy page";
            copied.value = false;
          }, 2e3);
        },
        () => {
          copyLabel.value = "Copy failed";
          setTimeout(() => {
            copyLabel.value = "Copy page";
          }, 2e3);
        }
      );
    }
    function toggleDropdown() {
      openDropdownMenu.value = !openDropdownMenu.value;
    }
    function closeDropdown() {
      openDropdownMenu.value = false;
    }
    function openInProvider(provider) {
      route.path;
      const pageUrl = "";
      const mdxUrl = "";
      const githubUrl = props.data.editOnGithub || "";
      provider.urlTemplate.replace(/\{url\}/g, encodeURIComponent(pageUrl)).replace(/\{mdxUrl\}/g, encodeURIComponent(mdxUrl)).replace(/\{githubUrl\}/g, githubUrl);
      closeDropdown();
    }
    return (_ctx, _push, _parent, _attrs) => {
      var _a, _b;
      _push(ssrRenderComponent(_sfc_main$3, mergeProps({
        entry: entry.value,
        "toc-enabled": tocEnabledVal.value,
        "toc-style": tocStyleVal.value,
        "breadcrumb-enabled": breadcrumbEnabled.value,
        "previous-page": (_a = __props.data.previousPage) != null ? _a : null,
        "next-page": (_b = __props.data.nextPage) != null ? _b : null,
        "edit-on-github": showEditOnGithub.value ? __props.data.editOnGithub : null,
        "last-modified": showLastUpdatedInFooter.value ? __props.data.lastModified : null,
        "llms-txt-enabled": llmsTxtEnabled.value
      }, _attrs), {
        default: withCtx((_, _push2, _parent2, _scopeId) => {
          var _a2;
          if (_push2) {
            if (showActionsAbove.value) {
              _push2(`<div class="fd-page-actions" data-page-actions${ssrRenderAttr("data-actions-alignment", pageActionsAlignment.value)}${_scopeId}>`);
              if (copyMarkdownEnabled.value) {
                _push2(`<button type="button" class="fd-page-action-btn" aria-label="Copy page content"${ssrRenderAttr("data-copied", copied.value)}${_scopeId}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${_scopeId}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"${_scopeId}></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"${_scopeId}></path></svg><span${_scopeId}>${ssrInterpolate(copyLabel.value)}</span></button>`);
              } else {
                _push2(`<!---->`);
              }
              if (openDocsEnabled.value && openDocsProviders.value.length > 0) {
                _push2(`<div class="fd-page-action-dropdown"${_scopeId}><button type="button" class="fd-page-action-btn"${ssrRenderAttr("aria-expanded", openDropdownMenu.value)} aria-haspopup="true"${_scopeId}><span${_scopeId}>Open in</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${_scopeId}><polyline points="6 9 12 15 18 9"${_scopeId}></polyline></svg></button><div class="fd-page-action-menu" role="menu"${ssrIncludeBooleanAttr(!openDropdownMenu.value) ? " hidden" : ""}${_scopeId}><!--[-->`);
                ssrRenderList(openDocsProviders.value, (provider) => {
                  _push2(`<a role="menuitem" href="#" class="fd-page-action-menu-item"${_scopeId}><span class="fd-page-action-menu-label"${_scopeId}>Open in ${ssrInterpolate(provider.name)}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${_scopeId}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"${_scopeId}></path><polyline points="15 3 21 3 21 9"${_scopeId}></polyline><line x1="10" y1="14" x2="21" y2="3"${_scopeId}></line></svg></a>`);
                });
                _push2(`<!--]--></div></div>`);
              } else {
                _push2(`<!---->`);
              }
              _push2(`</div>`);
            } else {
              _push2(`<!---->`);
            }
            _push2(`<h1 class="fd-page-title"${_scopeId}>${ssrInterpolate(__props.data.title)}</h1>`);
            if (__props.data.description) {
              _push2(`<p class="fd-page-description"${_scopeId}>${ssrInterpolate(__props.data.description)}</p>`);
            } else {
              _push2(`<!---->`);
            }
            if (showLastUpdatedBelowTitle.value && __props.data.lastModified) {
              _push2(`<p class="fd-last-modified fd-last-modified-below-title"${_scopeId}> Last updated: ${ssrInterpolate(__props.data.lastModified)}</p>`);
            } else {
              _push2(`<!---->`);
            }
            if (showActionsBelow.value) {
              _push2(`<!--[--><hr class="fd-page-actions-divider" aria-hidden="true"${_scopeId}><div class="fd-page-actions" data-page-actions${ssrRenderAttr("data-actions-alignment", pageActionsAlignment.value)}${_scopeId}>`);
              if (copyMarkdownEnabled.value) {
                _push2(`<button type="button" class="fd-page-action-btn" aria-label="Copy page content"${ssrRenderAttr("data-copied", copied.value)}${_scopeId}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${_scopeId}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"${_scopeId}></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"${_scopeId}></path></svg><span${_scopeId}>${ssrInterpolate(copyLabel.value)}</span></button>`);
              } else {
                _push2(`<!---->`);
              }
              if (openDocsEnabled.value && openDocsProviders.value.length > 0) {
                _push2(`<div class="fd-page-action-dropdown"${_scopeId}><button type="button" class="fd-page-action-btn"${ssrRenderAttr("aria-expanded", openDropdownMenu.value)} aria-haspopup="true"${_scopeId}><span${_scopeId}>Open in</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${_scopeId}><polyline points="6 9 12 15 18 9"${_scopeId}></polyline></svg></button><div class="fd-page-action-menu" role="menu"${ssrIncludeBooleanAttr(!openDropdownMenu.value) ? " hidden" : ""}${_scopeId}><!--[-->`);
                ssrRenderList(openDocsProviders.value, (provider) => {
                  _push2(`<a role="menuitem" href="#" class="fd-page-action-menu-item"${_scopeId}><span class="fd-page-action-menu-label"${_scopeId}>Open in ${ssrInterpolate(provider.name)}</span><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${_scopeId}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"${_scopeId}></path><polyline points="15 3 21 3 21 9"${_scopeId}></polyline><line x1="10" y1="14" x2="21" y2="3"${_scopeId}></line></svg></a>`);
                });
                _push2(`<!--]--></div></div>`);
              } else {
                _push2(`<!---->`);
              }
              _push2(`</div><!--]-->`);
            } else {
              _push2(`<!---->`);
            }
            _push2(`<div${_scopeId}>${(_a2 = htmlWithoutFirstH1.value) != null ? _a2 : ""}</div>`);
          } else {
            return [
              showActionsAbove.value ? (openBlock(), createBlock("div", {
                key: 0,
                class: "fd-page-actions",
                "data-page-actions": "",
                "data-actions-alignment": pageActionsAlignment.value
              }, [
                copyMarkdownEnabled.value ? (openBlock(), createBlock("button", {
                  key: 0,
                  type: "button",
                  class: "fd-page-action-btn",
                  "aria-label": "Copy page content",
                  "data-copied": copied.value,
                  onClick: handleCopyPage
                }, [
                  (openBlock(), createBlock("svg", {
                    width: "14",
                    height: "14",
                    viewBox: "0 0 24 24",
                    fill: "none",
                    stroke: "currentColor",
                    "stroke-width": "2",
                    "stroke-linecap": "round",
                    "stroke-linejoin": "round"
                  }, [
                    createVNode("rect", {
                      x: "9",
                      y: "9",
                      width: "13",
                      height: "13",
                      rx: "2",
                      ry: "2"
                    }),
                    createVNode("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
                  ])),
                  createVNode("span", null, toDisplayString(copyLabel.value), 1)
                ], 8, ["data-copied"])) : createCommentVNode("", true),
                openDocsEnabled.value && openDocsProviders.value.length > 0 ? (openBlock(), createBlock("div", {
                  key: 1,
                  class: "fd-page-action-dropdown"
                }, [
                  createVNode("button", {
                    type: "button",
                    class: "fd-page-action-btn",
                    "aria-expanded": openDropdownMenu.value,
                    "aria-haspopup": "true",
                    onClick: toggleDropdown
                  }, [
                    createVNode("span", null, "Open in"),
                    (openBlock(), createBlock("svg", {
                      width: "12",
                      height: "12",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      "stroke-width": "2",
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round"
                    }, [
                      createVNode("polyline", { points: "6 9 12 15 18 9" })
                    ]))
                  ], 8, ["aria-expanded"]),
                  createVNode("div", {
                    class: "fd-page-action-menu",
                    role: "menu",
                    hidden: !openDropdownMenu.value
                  }, [
                    (openBlock(true), createBlock(Fragment, null, renderList(openDocsProviders.value, (provider) => {
                      return openBlock(), createBlock("a", {
                        key: provider.name,
                        role: "menuitem",
                        href: "#",
                        class: "fd-page-action-menu-item",
                        onClick: withModifiers(($event) => openInProvider(provider), ["prevent"])
                      }, [
                        createVNode("span", { class: "fd-page-action-menu-label" }, "Open in " + toDisplayString(provider.name), 1),
                        (openBlock(), createBlock("svg", {
                          width: "12",
                          height: "12",
                          viewBox: "0 0 24 24",
                          fill: "none",
                          stroke: "currentColor",
                          "stroke-width": "2",
                          "stroke-linecap": "round",
                          "stroke-linejoin": "round"
                        }, [
                          createVNode("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
                          createVNode("polyline", { points: "15 3 21 3 21 9" }),
                          createVNode("line", {
                            x1: "10",
                            y1: "14",
                            x2: "21",
                            y2: "3"
                          })
                        ]))
                      ], 8, ["onClick"]);
                    }), 128))
                  ], 8, ["hidden"])
                ])) : createCommentVNode("", true)
              ], 8, ["data-actions-alignment"])) : createCommentVNode("", true),
              createVNode("h1", { class: "fd-page-title" }, toDisplayString(__props.data.title), 1),
              __props.data.description ? (openBlock(), createBlock("p", {
                key: 1,
                class: "fd-page-description"
              }, toDisplayString(__props.data.description), 1)) : createCommentVNode("", true),
              showLastUpdatedBelowTitle.value && __props.data.lastModified ? (openBlock(), createBlock("p", {
                key: 2,
                class: "fd-last-modified fd-last-modified-below-title"
              }, " Last updated: " + toDisplayString(__props.data.lastModified), 1)) : createCommentVNode("", true),
              showActionsBelow.value ? (openBlock(), createBlock(Fragment, { key: 3 }, [
                createVNode("hr", {
                  class: "fd-page-actions-divider",
                  "aria-hidden": "true"
                }),
                createVNode("div", {
                  class: "fd-page-actions",
                  "data-page-actions": "",
                  "data-actions-alignment": pageActionsAlignment.value
                }, [
                  copyMarkdownEnabled.value ? (openBlock(), createBlock("button", {
                    key: 0,
                    type: "button",
                    class: "fd-page-action-btn",
                    "aria-label": "Copy page content",
                    "data-copied": copied.value,
                    onClick: handleCopyPage
                  }, [
                    (openBlock(), createBlock("svg", {
                      width: "14",
                      height: "14",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      "stroke-width": "2",
                      "stroke-linecap": "round",
                      "stroke-linejoin": "round"
                    }, [
                      createVNode("rect", {
                        x: "9",
                        y: "9",
                        width: "13",
                        height: "13",
                        rx: "2",
                        ry: "2"
                      }),
                      createVNode("path", { d: "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" })
                    ])),
                    createVNode("span", null, toDisplayString(copyLabel.value), 1)
                  ], 8, ["data-copied"])) : createCommentVNode("", true),
                  openDocsEnabled.value && openDocsProviders.value.length > 0 ? (openBlock(), createBlock("div", {
                    key: 1,
                    class: "fd-page-action-dropdown"
                  }, [
                    createVNode("button", {
                      type: "button",
                      class: "fd-page-action-btn",
                      "aria-expanded": openDropdownMenu.value,
                      "aria-haspopup": "true",
                      onClick: toggleDropdown
                    }, [
                      createVNode("span", null, "Open in"),
                      (openBlock(), createBlock("svg", {
                        width: "12",
                        height: "12",
                        viewBox: "0 0 24 24",
                        fill: "none",
                        stroke: "currentColor",
                        "stroke-width": "2",
                        "stroke-linecap": "round",
                        "stroke-linejoin": "round"
                      }, [
                        createVNode("polyline", { points: "6 9 12 15 18 9" })
                      ]))
                    ], 8, ["aria-expanded"]),
                    createVNode("div", {
                      class: "fd-page-action-menu",
                      role: "menu",
                      hidden: !openDropdownMenu.value
                    }, [
                      (openBlock(true), createBlock(Fragment, null, renderList(openDocsProviders.value, (provider) => {
                        return openBlock(), createBlock("a", {
                          key: provider.name,
                          role: "menuitem",
                          href: "#",
                          class: "fd-page-action-menu-item",
                          onClick: withModifiers(($event) => openInProvider(provider), ["prevent"])
                        }, [
                          createVNode("span", { class: "fd-page-action-menu-label" }, "Open in " + toDisplayString(provider.name), 1),
                          (openBlock(), createBlock("svg", {
                            width: "12",
                            height: "12",
                            viewBox: "0 0 24 24",
                            fill: "none",
                            stroke: "currentColor",
                            "stroke-width": "2",
                            "stroke-linecap": "round",
                            "stroke-linejoin": "round"
                          }, [
                            createVNode("path", { d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" }),
                            createVNode("polyline", { points: "15 3 21 3 21 9" }),
                            createVNode("line", {
                              x1: "10",
                              y1: "14",
                              x2: "21",
                              y2: "3"
                            })
                          ]))
                        ], 8, ["onClick"]);
                      }), 128))
                    ], 8, ["hidden"])
                  ])) : createCommentVNode("", true)
                ], 8, ["data-actions-alignment"])
              ], 64)) : createCommentVNode("", true),
              createVNode("div", { innerHTML: htmlWithoutFirstH1.value }, null, 8, ["innerHTML"])
            ];
          }
        }),
        _: 1
      }, _parent));
    };
  }
});
const _sfc_setup$2 = _sfc_main$2.setup;
_sfc_main$2.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("../../node_modules/.pnpm/@farming-labs+nuxt-theme@0.0.19_nuxt@3.21.1_@parcel+watcher@2.5.6_@types+node@22.19.11_@verce_c2kauwg57ebbaat4wvbaomz2li/node_modules/@farming-labs/nuxt-theme/src/components/DocsContent.vue");
  return _sfc_setup$2 ? _sfc_setup$2(props, ctx) : void 0;
};
const DefaultUIDefaults = {
  colors: {
    primary: "#6366f1",
    background: "#ffffff",
    muted: "#64748b",
    border: "#e5e7eb"
  },
  typography: {
    font: {
      style: {
        sans: "Inter, system-ui, sans-serif",
        mono: "JetBrains Mono, monospace"
      },
      h1: { size: "2rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 280,
    toc: { enabled: true, depth: 3, style: "default" },
    header: { height: 72, sticky: true }
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" }
  }
};
createTheme({
  name: "fumadocs-default",
  ui: DefaultUIDefaults
});
const PixelBorderUIDefaults = {
  colors: {
    primary: "oklch(0.985 0.001 106.423)",
    background: "hsl(0 0% 2%)",
    muted: "hsl(0 0% 55%)",
    border: "hsl(0 0% 15%)"
  },
  typography: {
    font: {
      style: {
        sans: "system-ui, -apple-system, sans-serif",
        mono: "ui-monospace, monospace"
      },
      h1: { size: "2.25rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3", letterSpacing: "-0.01em" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 860,
    sidebarWidth: 286,
    toc: { enabled: true, depth: 3 },
    header: { height: 56, sticky: true }
  },
  components: {}
};
createTheme({
  name: "fumadocs-pixel-border",
  ui: PixelBorderUIDefaults
});
const DarksharpUIDefaults = {
  colors: {
    primary: "#fafaf9",
    background: "#000000",
    muted: "#a8a29e",
    border: "#292524"
  },
  typography: {
    font: {
      style: {
        sans: "Geist, system-ui, sans-serif",
        mono: "Geist Mono, monospace"
      },
      h1: { size: "2rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 280,
    toc: { enabled: true, depth: 3 },
    header: { height: 56, sticky: true }
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" }
  }
};
createTheme({
  name: "fumadocs-darksharp",
  ui: DarksharpUIDefaults
});
const _sfc_main$1 = /* @__PURE__ */ defineComponent({
  __name: "AskAITrigger",
  __ssrInlineRender: true,
  props: {
    aiLabel: { default: "AI" }
  },
  setup(__props) {
    return (_ctx, _push, _parent, _attrs) => {
      _push(`<button${ssrRenderAttrs(mergeProps({
        type: "button",
        class: "ask-ai-trigger",
        "aria-label": `Ask ${__props.aiLabel}`
      }, _attrs))} data-v-3362ce82><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" data-v-3362ce82><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" data-v-3362ce82></path><path d="M20 3v4" data-v-3362ce82></path><path d="M22 5h-4" data-v-3362ce82></path></svg> Ask ${ssrInterpolate(__props.aiLabel)}</button>`);
    };
  }
});
const _sfc_setup$1 = _sfc_main$1.setup;
_sfc_main$1.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("components/AskAITrigger.vue");
  return _sfc_setup$1 ? _sfc_setup$1(props, ctx) : void 0;
};
const AskAITrigger = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["__scopeId", "data-v-3362ce82"]]);
const ColorfulUIDefaults = {
  colors: {
    primary: "hsl(40, 96%, 40%)",
    background: "#ffffff",
    muted: "#64748b",
    border: "#e5e7eb"
  },
  typography: {
    font: {
      style: {
        sans: "Inter, system-ui, sans-serif",
        mono: "JetBrains Mono, monospace"
      },
      h1: { size: "1.875rem", weight: 700, lineHeight: "1.2", letterSpacing: "-0.02em" },
      h2: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      h3: { size: "1.25rem", weight: 600, lineHeight: "1.4" },
      h4: { size: "1.125rem", weight: 600, lineHeight: "1.4" },
      body: { size: "1rem", weight: 400, lineHeight: "1.75" },
      small: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  },
  layout: {
    contentWidth: 768,
    sidebarWidth: 260,
    toc: { enabled: true, depth: 3, style: "default" },
    header: { height: 56, sticky: true }
  },
  components: {
    Callout: { variant: "soft", icon: true },
    CodeBlock: { showCopyButton: true },
    Tabs: { style: "default" }
  }
};
const colorful = createTheme({
  name: "fumadocs-colorful",
  ui: ColorfulUIDefaults
});
const config = defineDocs({
  entry: "docs",
  contentDir: "docs",
  theme: colorful({
    ui: {
      // colors: {
      //   primary: "oklch(0.985 0.001 106.423)",
      //   background: "hsl(0 0% 2%)",
      // },
      typography: {
        font: {
          style: {
            sans: "system-ui, -apple-system, sans-serif",
            mono: "ui-monospace, monospace"
          },
          h1: { size: "2.25rem", weight: 700, letterSpacing: "-0.02em" },
          h2: { size: "1.5rem", weight: 600, letterSpacing: "-0.01em" },
          h3: { size: "1.25rem", weight: 600 },
          body: { size: "1rem", lineHeight: "1.75" }
        }
      }
    }
  }),
  nav: {
    title: "Example Docs",
    url: "/docs"
  },
  ai: {
    enabled: true,
    model: "gpt-4o-mini",
    maxResults: 5,
    aiLabel: "DocsBot",
    floatingStyle: "full-modal",
    mode: "floating",
    position: "bottom-right",
    suggestedQuestions: [
      "How do I get started?",
      "What databases are supported?",
      "How do I configure authentication?",
      "How do I set up social sign-on?"
    ]
  },
  themeToggle: { enabled: true, default: "dark" },
  breadcrumb: { enabled: true },
  metadata: {
    titleTemplate: "%s \u2013 Docs",
    description: "Awesome docs powered by @farming-labs/docs (Nuxt)"
  },
  pageActions: {
    alignment: "right",
    copyMarkdown: { enabled: true },
    openDocs: {
      enabled: true,
      providers: [
        {
          name: "ChatGPT",
          urlTemplate: "https://chatgpt.com/?hints=search&q=Read+{mdxUrl},+I+want+to+ask+questions+about+it."
        },
        {
          name: "Claude",
          urlTemplate: "https://claude.ai/new?q=Read+{mdxUrl},+I+want+to+ask+questions+about+it."
        }
      ]
    }
  },
  llmsTxt: { enabled: true, baseUrl: "https://docs.farming-labs.dev" },
  ordering: "numeric"
});
const _sfc_main = /* @__PURE__ */ defineComponent({
  __name: "[...slug]",
  __ssrInlineRender: true,
  async setup(__props) {
    let __temp, __restore;
    const route = useRoute$1();
    const pathname = computed(() => route.path);
    const { data, error } = ([__temp, __restore] = withAsyncContext(() => useFetch(
      "/api/docs",
      {
        query: { pathname },
        watch: [pathname]
      },
      "$iWbRZSn6I-"
      /* nuxt-injected */
    )), __temp = await __temp, __restore(), __temp);
    if (error.value) {
      throw createError({
        statusCode: 404,
        statusMessage: "Page not found"
      });
    }
    return (_ctx, _push, _parent, _attrs) => {
      if (unref(data)) {
        _push(`<div${ssrRenderAttrs(mergeProps({ class: "fd-docs-wrapper" }, _attrs))}>`);
        _push(ssrRenderComponent(unref(_sfc_main$6), {
          tree: unref(data).tree,
          config: unref(config),
          "trigger-component": AskAITrigger
        }, {
          default: withCtx((_, _push2, _parent2, _scopeId) => {
            if (_push2) {
              _push2(ssrRenderComponent(unref(_sfc_main$2), {
                data: unref(data),
                config: unref(config)
              }, null, _parent2, _scopeId));
            } else {
              return [
                createVNode(unref(_sfc_main$2), {
                  data: unref(data),
                  config: unref(config)
                }, null, 8, ["data", "config"])
              ];
            }
          }),
          _: 1
        }, _parent));
        _push(`</div>`);
      } else {
        _push(`<!---->`);
      }
    };
  }
});
const _sfc_setup = _sfc_main.setup;
_sfc_main.setup = (props, ctx) => {
  const ssrContext = useSSRContext();
  (ssrContext.modules || (ssrContext.modules = /* @__PURE__ */ new Set())).add("pages/docs/[...slug].vue");
  return _sfc_setup ? _sfc_setup(props, ctx) : void 0;
};

export { _sfc_main as default };
//# sourceMappingURL=_...slug_-DkaWrzyu.mjs.map
