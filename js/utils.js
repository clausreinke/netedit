//
// auxiliary definitions
//
// TODO: wrap in its own namespace
// TODO: add updateElement/updateElementNS

define("utils.js",[],function(){

var svgNS = 'http://www.w3.org/2000/svg';

// TODO: touchcancel? "real" pointer events spec?
var pointerEvents = ('ontouchstart' in window)
  ? {start : 'touchstart', move: 'touchmove', end: 'touchend' }
  : {start : 'mousedown', move: 'mousemove', end: 'mouseup' }

/**
 * bind function 'this'-reference (mostly so that we can register 
 * model object methods as view object event listeners, with
 * 'this' still referring to the model object)
 * NOTE: modern JS-implementations may already have this as a
 *       method (ES5)
 *  
 * @param f
 * @param x
 */
function bind(f,x) {
  return function() {
    return f.apply(x,arguments);
  };
}

/**
 * shorthand notation for element creation
 * 
 * @param tag
 * @param attributes
 * @param children
 */
function element(tag,attributes,children) {
   var e = document.createElement(tag);
   for (var a in attributes) e.setAttribute(a,attributes[a]);
   for (var c in children) e.appendChild(children[c]);
   return e;
}

/**
 * shorthand notation for namespaced element creation
 * 
 * @param ns
 * @param tag
 * @param attributes
 * @param children
 */
function elementNS(ns,tag,attributes,children) {
   var e = document.createElementNS(ns,tag);
   setAttributesNS(e,attributes);
   for (var c in children) e.appendChild(children[c]);
   return e;
}

/**
 * shorthand for setting namespaced element attributes
 * 
 * @param e
 * @param attributes
 */
function setAttributesNS(e,attributes) {
   for (var a in attributes) e.setAttributeNS(null,a,attributes[a]);
}

// exports
return { svgNS:           svgNS
       , bind:            bind
       , element:         element
       , elementNS:       elementNS
       , setAttributesNS: setAttributesNS
       , pointerEvents:   pointerEvents
       };
});
