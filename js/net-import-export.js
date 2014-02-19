//
// Net import/export (load on top of net.js)
//
// dependency: utils.js
// dependency: vector.js
// dependency: debug.js
// dependency: net.js

module("net-import-export.js",["net.js","debug.js","vector.js","utils.js"]
      ,function(net,debug,vector,utils) {

// TODO: we have extra lines accumulating around text node contents
//       during import/export loops (as well as extra whitespace around
//       text nodes during Node.rename)

// TODO: - separate take/guard from put
//       - notify UI: transition enabling/firing
/**
 * generate code for net
 */
net.Net.prototype.generateCode = function() { // {{{

  function take(a,i) {
    return (i>0?"return ":"")+"NDS.take('"+a.source.name+"', function("+(a.label||"_")+") {"
  }

  function guard(t) {
    return (t.arcsIn.length>0?"return ":"")+"NDS.guard(true, function() {"
  }

  function put(a) {
    return "return NDS.put('"+a.target.name+"',"+(a.label||"undefined")+", function() {"
  }

  // TODO: assign transition code to var
  function transition_code(t) {
    return ["// "+t.name,"var "+t.name+" = "]
            .concat(t.arcsIn.map(take))
            .concat(guard(t))
            .concat(t.arcsOut.map(put))
            .concat("return NDS.noop"
                   ,Array(t.arcsOut.length+1).join("})")
                   ,"})"
                   ,Array(t.arcsIn.length+1).join("})")
                   ,";"
                   ,"transitions.push("+t.name+");");
  }

  var ts_code = [].concat.apply([]
                               ,Object.keys(this.transitions)
                                  .map(function(key){
                                    return transition_code(this.transitions[key])
                                   }.bind(this)) );

  var marking_code = "var marking = { "
                     + Object.keys(this.places)
                        .map(function(key){
                          var place = this.places[key];
                          return place.name+": "+(place.marking||"[]")
                         }.bind(this) )
                        .join("\n\t, ")
                     + "\n\t};";

  var net_code = ["// generated code"
                 ,"var transitions = []"
                 ].concat(ts_code
                         ,marking_code
                         ,"console.log(run(transitions,marking));"
                         );

  return net_code.join("\n");
} // }}}

/**
 * render Net as PNML document string
 */
net.Net.prototype.toPNML = function() { // {{{
  // auxiliary definitions for PNML format elements
  var dimension  = function(x,y) { 
                    return utils.elementNS(null,'dimension',{'x':x,'y':y});
                   }
  var position   = function(x,y) {
                    return utils.elementNS(null,'position',{'x':x,'y':y});
                   }
  var graphics   = function(children) {
                    return utils.elementNS(null,'graphics',{},children);
                   }
  var name       = function(text) {
                     return utils.elementNS(null,'name',{}
                                           ,[utils.elementNS(null,'text',{}
                                                            ,[document.createTextNode(text)])]);
                   }
  var imarking   = function(text) {
                     return utils.elementNS(null,'initialMarking',{}
                                           ,[utils.elementNS(null,'text',{}
                                                            ,[document.createTextNode(text)])]);
                   }
  var place      = function(id,n,m,x,y) {
                     return utils.elementNS(null,'place'
                                           ,{'id':id}
                                           ,[name(n),graphics([position(x,y)])]
                                            .concat(m?[imarking(m)]:[]));
                   }
  var transition = function(id,n,x,y) {
                    return utils.elementNS(null,'transition'
                                          ,{'id':id}
                                          ,[name(n),graphics([position(x,y)])]);
                   }
  var inscription= function(text,pos) {
                     return utils.elementNS(null,'inscription',{}
                                           ,[utils.elementNS(null,'text',{}
                                                            ,[document.createTextNode(text)])
                                            ,graphics([position(pos.x,pos.y)])]);
                   }
  var arc        = function(id,source,target,label,labelPos,positions) {
                     return utils.elementNS(null,'arc' // TODO: label position
                                           ,{'id':id,'source':source,'target':target}
                                           ,((positions && positions.length>0)
                                             ? [graphics(positions.map(function(p){
                                                          return position(p.x,p.y);
                                                         }))]
                                             : []).concat( label ? [inscription(label,labelPos)] : []) );
                   }
  var net        = function(type,id,children) {
                     return utils.elementNS(null,'net'
                                           ,{'type':type,'id':id}
                                           ,children);
                   }

  // start building: places, transitions, arcs, then the full net
  var ps = []; 
    for(var pi in this.places) {
      var p=this.places[pi];
      ps.push(place(p.id,p.name,p.marking,p.pos.x,p.pos.y));
    };
  var ts = [];
    for(var ti in this.transitions) {
      var t=this.transitions[ti];
      ts.push(transition(t.id,t.name,t.pos.x,t.pos.y));
    };
  var as = [];
    for(var ai in this.arcs) {
      var a=this.arcs[ai];
      as.push(arc('arc'+ai,a.source.id,a.target.id,a.label,a.labelPos,a.midpoints));
    };
  var n = net("http://www.pnml.org/version-2009/grammar/ptnet",'net'
             ,[name('example') // TODO
              ,graphics([dimension(this.width,this.height)
                        ,position(0,0)])
              ].concat(ts,ps,as));

  // embed the net in a PNML document, return its XML rendering
  var pnml = document.implementation.createDocument("http://www.pnml.org/version-2009/grammar/pnml",'pnml',null);
  pnml.documentElement.appendChild(n);

  return debug.listXML('',pnml.documentElement).join("\n");
} // }}}

/**
 * extract some Net data (dimensions, places, transitions, arcs, node names and
 * positions) from PNML document string pnml; coordinates can optionally be
 * scaled, node dimension units can optionally be changed from default;
 * (note: this isn't a complete parse, and PNML files do not always contain all
 * the information needed to reproduce a view unambiguosly)
 * 
 * @param pnml
 * @param scale
 * @param unit
 */
net.Net.prototype.fromPNML = function(pnml,scale,unit) { // {{{
  if (pnml.querySelectorAll) {
    // if the standard specifies any default scale/unit at all, not all PNML
    // files use those
    var scale = scale ? scale : 1; 
    var unit  = unit ? unit : 10; 
    // first, try to extract viewBox dimensions
    var d = pnml.querySelector('net>graphics>dimension');
    var p = pnml.querySelector('net>graphics>position');
    var px = p ? p.attributes['x'].nodeValue : '0';
    var py = p ? p.attributes['y'].nodeValue : '0';
    var dx = d ? d.attributes['x'].nodeValue : '1000';
    var dy = d ? d.attributes['y'].nodeValue : '1000';
    this.setViewSize(px,py,dx,dy);
    debug.message('** net dimensions '+p+'|'+d+' : '+px+' '+py+' '+dx+' '+dy);
    // if dimensions are missing, we'll try to estimate them
    // (we keep track of max node coordinates)
    if (!d) { dx = 0; dy = 0; } 

    // extract minimal info about places (name, position), transitions (name,
    // position) and arcs (source, target), add corresponding elements to Net
    // note: we could common up the two node loops place/transition, but
    //       attributes for higher level nets will differ between the two
    var places = pnml.querySelectorAll('place');
    for (var i=0; i<places.length; i++) {
      var place = places[i];
      var id    = place.getAttributeNS(null,'id');
      var name  = place.querySelector('name>text');
      var pos   = place.querySelector('graphics>position');
      var imark = place.querySelector('initialMarking>text');
      if (pos) {
        var x     = pos.attributes['x'].nodeValue;
        var y     = pos.attributes['y'].nodeValue;
        px = Math.min(px,x); dx = Math.max(dx,x);
        py = Math.min(py,y); dy = Math.max(dy,y);
        // debug.message(id+': '+(name?name.textContent:'')+' '+x+'/'+y);
        this.addPlace(id,x*scale,y*scale,unit
                     ,name?name.textContent:null
                     ,imark?imark.textContent:"");
      } else {
        debug.message('sorry, no automatic layout - all nodes should have positions');
        debug.messagePre(debug.listXML('',place).join("\n"));
      }
    }

    var transitions = pnml.querySelectorAll('transition');
    for (var i=0; i<transitions.length; i++) {
      var transition = transitions[i];
      var id    = transition.getAttributeNS(null,'id');
      var name  = transition.querySelector('name>text');
      var pos   = transition.querySelector('graphics>position');
      if (pos) {
        var x     = pos.attributes['x'].nodeValue;
        var y     = pos.attributes['y'].nodeValue;
        px = Math.min(px,x); dx = Math.max(dx,x);
        py = Math.min(py,y); dy = Math.max(dy,y);
        // debug.message(id+': '+(name?name.textContent:'')+' '+x+'/'+y);
        this.addTransition(id,x*scale,y*scale,2*unit,2*unit,name?name.textContent:null);
      } else {
        debug.message('sorry, no automatic layout - all nodes should have positions');
        debug.messagePre(debug.listXML('',transition).join("\n"));
      }
    }

    var arcs = pnml.querySelectorAll('arc'); //TODO: labels
    for (var i=0; i<arcs.length; i++) {
      var arc = arcs[i];
      var id  = arc.getAttributeNS(null,'id');
      var sourceId = arc.getAttributeNS(null,'source');
      var targetId = arc.getAttributeNS(null,'target');
      // debug.message(id+': '+sourceId+' -> '+targetId);
      var label    = arc.querySelector('inscription>text');
      if (label) {
        label = label.textContent;
      }
      var labelPos = arc.querySelector('inscription>graphics>position');
      if (labelPos) {
        labelPos = { x: labelPos.getAttributeNS(null,'x')
                   , y: labelPos.getAttributeNS(null,'y')};
      }
      var positions = arc.querySelectorAll('arc>graphics>position');
      if (positions.length>0) {
        var midpoints = [];
        for (var j=0; j<positions.length; j++) {
          var pos = positions[j];
          var x   = pos.attributes['x'].nodeValue;
          var y   = pos.attributes['y'].nodeValue;
          midpoints.push(new vector.Pos(x,y));
        }
      } else
        var midpoints = null;
      if (this.transitions[sourceId] && this.places[targetId])
        this.addArc(this.transitions[sourceId],this.places[targetId],label,labelPos,midpoints);
      else if (this.places[sourceId] && this.transitions[targetId])
        this.addArc(this.places[sourceId],this.transitions[targetId],label,labelPos,midpoints);
      else
        debug.message('cannot find source and target');
    }

    if (!p || !d) { // no dimensions specified, try bounding box instead
                    // the svg contents bounding box doesn't seem to work right
                    // (apparently, that issue is opera-specific, works in firefox?)
                    // so we use the min/max node coordinates as an approximation
                    // [PNML files should specify intended dimensions to avoid this]
                    // TODO: if there were no useable nodes (no positions specified),
                    //       there is no useable bounding box either..
      var bbox = this.contents.getBBox(); // TODO: why isn't this tight in opera 10.10?
      debug.message('** (min/max) '+px+' '+py+' '+dx+' '+dy);
      debug.listProperties('contents.BBox',bbox);
      if (false&&navigator.appName.match(/Opera/)) // TODO: bounding box bug fixed in 10.51?
        this.setViewSize(px,py,dx+10,dy+10);
      else
        this.setViewSize(bbox.x,bbox.y,bbox.width,bbox.height);
    }
  } else
    throw('querySelectorAll not supported');
} // }}}

/**
 * add import PNML, export PNML, export SVG controls to document, just before
 * the Net's SVG node;
 */
net.Net.prototype.addImportExportControls = function () { // {{{

  var net = this; // for use in event handler closures

  // importing PNML files (partially implemented)
  var importButton   = utils.element('input'
                                    ,{"type" : 'submit'
                                     ,"id"   : 'importButton'
                                     ,"value": 'import PNML'
                                     });
  var importSelector = utils.element('input'
                                    ,{"type" : 'file'
                                     ,"id"   : 'importSelector'
                                     ,"title": 'select PNML file to import'
                                     ,"style": 'width: auto'
                                     });
  var importForm     = utils.element('form'
                                    ,{'action':'#'
                                     ,'style' :'display: inline; margin-left: 10px'}
                                    ,[importButton,importSelector]);
  importForm.addEventListener('submit',function(event){
      event.preventDefault();
      // grr; while it is easy to import files in the current directory, things
      // get difficult if one likes to organize one's file in a pnml/
      // subdirectory: file selectors only give fake_path + file name, no
      // relative path (security considerations which apply to absolute paths
      // seem to have been interpreted too eagerly?);
      //
      // workaround in opera: enter relative path manually in input field
      // this workaround doesn't work in firefox (field is not editable);
      // it is also awkward because the file selector will insert absolute
      // paths (and with '\' instead of '/' on windows), which need to be
      // edited by hand (field value not accessible);
      //
      // workaround in firefox: use File API, read file without path
      // this doesn't work in opera (no File API yet), but if opera starts
      // supporting the File API, this would be the preferred/standard way,
      // so we use File Api by default, and XMLHttpRequest as a fallback;
      //
      // (a more radical approach would be to switch to using the browsers'
      // widget/elevated-permissions modes)
      // TODO: clean up!
      var pnml = null;
      function processPNML(pnml) {
        if (pnml) {
          // TODO: is there a way to determine whether the load was successful?
          //       it seems we can get back a non-null but useless responseXML
          //       if the filename wasn't valid, and the status doesn't seem
          //       helpful for local files (when there was no webserver involved)?
          net.removeAll();
          try { net.fromPNML(pnml) }
          catch (e) {
            debug.message('PNML document could not be interpreted (is the filename correct?):');
            debug.messagePre('Exception: '+e.toString());
            debug.messagePre(debug.listXML('',pnml).join("\n"));
          }
        } else
          debug.message('no PNML file loaded');
      }

      debug.message('importing PNML file '+importSelector.value);
      if (importSelector.files // use File API, if present and useable
         // && !navigator.appName.match(/Opera/)        // not useable
         // && !navigator.appVersion.match(/Safari/)    // not useable
         ) {
        debug.message('File API available');
        var file = importSelector.files.item ? importSelector.files.item(0)
/* TODO: re-check this */                    : importSelector.files.item[0]; // opera 11.50
        if (file) {
          // TODO: safari 5.0 and opera 11.50 can't do anything with the file here?
          //       workaround: use XHR route for now
          var contents = null; // file.getAsText(null);
          var reader = new FileReader();
          reader.onerror = function(evt) { console.log("read error"); debug.listProperties("reader",evt); };
          reader.onload = function(evt) {
            console.log("read done");
            contents = evt.target.result;
            debug.messagePre(contents);
            if (DOMParser) {
              var parser = new DOMParser();
              var pnml   = parser.parseFromString(contents,'text/xml');
              processPNML(pnml);
            } else
              debug.message('sorry, cannot find DOMParser');
          };
          reader.readAsText(file);
        } else {
          debug.message('sorry, no file name specified');
        }
      } else if (XMLHttpRequest) { // conventional route, limited by filepath security
        if (importSelector.value) {
          var filename = importSelector.value.replace(/^C:[\/\\]fake_?path[\/\\]/,'');
          debug.message('(useable portion of) filename is: '+filename);
          debug.message('(note: local filenames should be written as _relative_ paths with _forward_ slashes)');
          debug.message('falling back to XMLHttpRequest');
          var xhr = ((typeof ActiveXObject!=="undefined")
                    && new ActiveXObject("Microsoft.XMLHTTP")) // prefer in IE, for local access:-(
                  || new XMLHttpRequest(); // browser-specific, ok in opera/firefox
          try {
            xhr.open('GET',filename,false);
            xhr.send(null);
          } catch (e) {
            debug.message('unable to import PNML file: ');
            debug.messagePre(e.toString());
          }
          var pnml = null;
          if (xhr.responseText && 
              (!xhr.responseXML || xhr.responseXML && !xhr.responseXML.documentElement)) {
            // TODO: why do we end up here with IE9?
            if (DOMParser) {
              var parser = new DOMParser();
              var pnml   = parser.parseFromString(xhr.responseText,'text/xml');
            } else
              debug.message('sorry, cannot interpret XML data');
          } else
            var pnml = xhr.responseXML;
          // listProperties('xhr',xhr,/./,true);
          processPNML(pnml);
        } else
          debug.message('sorry, no file name specified');
      } else
        debug.message('unable to import PNML file');
      return false;
    },false);

  // exporting SVG files
  // TODO: - are size limits for data:-url still an issue? use document.write instead?
  //       - unlike opera, firefox doesn't seem to give us control of where to
  //         save, and under what name (everything goes in the download folder,
  //         with automatically generated names)
  //       - try window.open, to give ie users something to save?
  //       - apart from different attribute order, safari 5.0 seems to be missing join marker?
  var exportSVG = utils.element('input'
                               ,{"type" : 'button'
                                ,"id"   : 'exportSVG'
                                ,"value": 'export SVG'
                                ,"style": 'margin-left: 10px'
                                });
  exportSVG.addEventListener('click',function(){
      // clone svg, then remove interactive elements (not needed for static output)
      // NOTE: cloning in opera 10.10 seems to convert some attribute representations
      //       (eg, 'cx' from '100.1' to '100,1'); seems fixed in 10.51
      var svgOut = net.svg.cloneNode(true);
      svgOut.removeChild(svgOut.querySelector('#cursorPalette'));
      svgOut.removeChild(svgOut.querySelector('#netHelp'));
      // TODO: should we use DOM3 Load and Save / XMLSerializer / toXMLString instead?
      //        or the DOM tree walkers? otherwise, move listXML from debug to utils
      var xml = debug.listXML('',svgOut).join("\n");
      debug.messagePre(xml);
      delete svgOut;
      // location = 'data:image/svg+xml,'+encodeURIComponent(xml);
      // TODO: firefox used to crash here; no longer, but what was the problem?
      // use application/octet-stream to force "save as"-dialogue
      location = 'data:application/octet-stream,'+encodeURIComponent(xml);
    },false);

  // exporting PNML files (partially implemented)
  // TODO: - are size limits for data:-url still an issue? use document.write instead?
  //         (for now, we leave the debug printouts in; if data: should fail, one
  //         could still copy from the messages div to avoid loosing work)
  //       - unlike opera, firefox doesn't seem to give us control of where to
  //         save, and under what name (everything goes in the download folder,
  //         with automatically generated names)
  var exportPNML = utils.element('input'
                                ,{"type" : 'button'
                                 ,"id"   : 'exportPNML'
                                 ,"value": 'export PNML'
                                 ,"style": 'margin-left: 10px'
                                 });
  exportPNML.addEventListener('click',function(){
      var pnml = net.toPNML();
      debug.messagePre(pnml);
      // location = 'data:application/xml,'+encodeURIComponent(pnml);
      // use application/octet-stream to force "save as"-dialogue
      location = 'data:application/octet-stream,'+encodeURIComponent(pnml);
    },false);

  // generate code (in progress)
  var generateCode = utils.element('input'
                                  ,{"type" : 'button'
                                   ,"id"   : 'generateCode'
                                   ,"value": 'generate code'
                                   ,"style": 'margin-left: 10px'
                                   });
  generateCode.addEventListener('click',function(){
      var code = net.generateCode();
      debug.messagePre(code);
      // use application/octet-stream to force "save as"-dialogue
      location = 'data:application/octet-stream,'+encodeURIComponent(code);
    },false);

  // TODO: if we want to use this, eg, for cursor coordinates, we need
  //       better layout control
  var messageField = utils.element('div',{"id":'messageField'});

  var importExportGroup = utils.element('span'
                                       ,{"id":'importExportGroup'}
                                       ,[importForm,exportSVG,exportPNML
                                        ,generateCode,messageField]);
  this.netDiv.insertBefore(importExportGroup,this.svgDiv);
} // }}}

return { Net: net.Net
       };
});
