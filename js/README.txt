
----------------- a simple Petri net editor (Browser Javascript plus SVG)

Project home page: 
Author           : Claus Reinke <claus.reinke@talk21.com>

----------------- Summary:

  Can currently edit simple, single-page Place/Transition-Nets without markings,
  export them to PNML or SVG, and import them from PNML. Lots of basic features
  still missing in this initial version (also, consider it alpha quality!-)

PLEASE NOTE: this code is not in release state - it was partly a means for
             me to learn about writing an interactive SVG/in-browser
             application, partly a feasibility study. I've just converted my old
             darcs repo to git, to make it easier to access.  A quick status
             check (see below) shows that the new IE9 has fitted right in to the
             APIs I coded against, which is nice, but all the browsers,
             including those I originally tested with, no longer run the full
             code as they used to (hopefully just minor API evolution, but still
             disappointing, after less than a year).

             I plan to fix the features gone missing, so that the editor will be
             basic but useable once again, but have not yet decided how take
             this further afterwards (the user interface is not just basic, but
             old-fashioned, but I do want a Javascript-based Petri net editor,
             and if the old code doesn't look too bad a year later, there is
             only the problem of finding the time..).

             Feel free to play with it, don't blame me for anything, let
             me know if you find it useful, and please do not re-distribute!

----------------- Status check (27.06.2011): sad state of affairs..

  Opera 11.50
    import doesn't work (XMLHttpRequest gives empty results, no error messages;
      apparently, that is a security setting:
        opera:config->User Prefs->Allow File XMLHttpRequest
      is off by default; toggling to on makes import work)

  Firefox 5.0
    keyboard events stop working after first t/p
    doesn't embed svg in html

  Safari 5.0
    fickle event recognition

  IE 9
    arrow heads aren't filled
    export doesn't work (tries to open data url, no option to save?)
    doesn't embed svg in html

----------------- Files (see svgtest.xhtml for an example instantiation):

  debug.js
    debugging utilities

  utils.js
    general utilities

  vector.js
    basic 2d positions and vectors

  net-elements.js
    places/transitions, their common prototype Node, and arcs

  net.js
    main Net container (holds model object and view canvas)

  net-import-export.js
    add-on to Net, providing SVG export, PNML import/export

  svgtest.xhtml
    example instantiation

  critical_section.pnml
    example net in PNML format

  (as some files are still quite big, we use Vim's standard fold markers {{{ }}})

----------------- General notes:

  So far, this is more a browser-as-a-portable-GUI-library kind of application
  than a put-it-on-the-web thing (initial intended use case was to hook it into
  a Haskell code generator and simulator for Haskell-Coloured Petri Nets,
  eliminating the wxWidgets GUI lib dependency of an earlier HCPN
  implementation); hence, it is SVG only at the moment, and written to modern
  standards, rather than to browser quirks - currently, it works with opera and
  firefox (with few quirks), possibly with others, but definitely not with
  current versions of IE (IE9 will have better standards support again, if the
  preview reports are any indication, but I haven't tested with IE yet);

  Obviously, the frontend could have separate applications for putting Petri
  nets on the web, in blogs, tutorials, and the like, or as a simple GUI for
  other backends (different net types and their simulators);

  At minimum, we would need to add VML backend for pre-IE9 to support on-the-web
  for a larger audience (alternatives are any of the surviving cross-browser SVG
  plugins, such as svgweb, or js-graphics libraries with their own SVG/VML
  backends, such as raphael); defining an API for hooking up code generators or
  simulators would help with frontend reuse, and with putting dynamic Net
  simulations on the web;

  Note, however, that the use of standard, but fairly recent APIs requires
  equally recent browser versions (or framework middleware to make up for the
  difference). For now, we stick with Opera 10.10 and Firefox 3.62 as lower
  bounds (Safari 5.0 partially working).

  Talking about standards, we only support/use a subset of PNML so far (net,
  transition, place, transition/place names with default offsets, arcs with
  intermediate support points, net dimensions, node positions).

----------------- Implementation notes:

  We have a simple model object hierarchy, with each model object linked to a
  single set of view objects (the view is a simple shadow of the model, so if we
  want to enable multiple views per model object, we could insert an interface
  for registering views with model objects, so that all views get updated when
  the model changes)

  Net(id)
   main object; holds svg element, list of places, transitions, and arcs,
   as well as current selection, cursor mode, and help text; converts mouse
   event to svg canvas coordinates; handles adding/removing nodes and arcs

  Node(nodeType)
   common prototype for places and transitions; has text label, can be
   renamed, moved, deleted, and connected (with other nodes not of the same
   type); keeps track of incoming and outgoing arcs, position, id, and
   embedding Net object; subtypes have view objects in addition to text
   label, can update their view after changes, can calculate where arcs
   from/to a given position should connect with the view shape

   Place(net,id,pos)
   Transition(net,id,pos)

  Arc(source,target)
   connects a source and a target node via optional midpoints, has view object,
   can update its view after changes, can be deleted; this is an auxiliary
   object that mostly just follows whatever happens to the source and target
   nodes it is registered with

  Cursor(net)
   tracks Net it belongs to, mode of Net-global cursor operation (insert
   place or transition, connect nodes by arcs, delete nodes, toggle help);
   has a view that should help to indicate cursor mode
   

----------------- TODO (further entries in source files): {{{
      - add generic net traversal, or at least
         - static output formats (SVG done, but depends on SVG support;
            do we need javascript to work around non-SVG browsers? if so,
            we might as well output raphael instead and be done with it
            (might need to add marker support, though);
            should we try and figure out png support as a final fallback?)
         - import/export formats (PNML - import and export partially done)
      - add token model and view objects (net markings)
      - add inscriptions (token data, arc inscriptions, place types,
        transition guards, transition code), try to remain inscription
        language-independent
      - have separate svg groups to add nodes/arcs or labels to,
        to ensure that all labels overlap all other objects

      - support canvas scaling and scrolling (how does that interact
         with the dummy background we need for event capture?)
      - hook up to code generator / simulator
         (to help visualizing marking evolution, improved view handling would
          be helpful, so that we can select interesting places and add
          additional views to them, showing their tokens; task listed below)
      - provide api for trace viewing / simulator integration; a standard XML
        format for net simulation traces would be useful (initially sequences
        of marking changes instead of sequences of markings; later more
        complex trace structures, with alternatives and annotations - similar
        to annotated board game records, but using net-like format)

      - generalize view handling (generic view objects instead of
         Place/Transition/Arc-specific .p/.t/.a and .l)
      - support node resize (if we want asymmetric nodes, also rotation?)
      - allow default styling to be overridden via css (two issues:
         1. don't specify local style if applicable style exists
         2. we currently avoid css-style in favour of svg attributes;
         actually, 2 might be the solution instead of a problem?)
        can all configuration be handled via css or do we need additional
        attributes?
      - allow editing of element attributes (like label positioning, ..);
      - may need to prevent default event handling (overlap with
         browser keyboard shortcuts or drag&drop), but we only want to do
         that within the SVG canvas, while we seem forced to catch keyboard
         events outside..
      - command history/undo?
      - can we reduce the number of explicitly named xml-namespaces 
        in svg createElementNSs, without running into problems when 
        manipulating those elements (compare svg/pnml exports)?
      - this was initially meant to use modern standards-compliant browsers
        as portable GUI libraries, so we only test with/support opera and
        firefox; users will probably ask for other browsers nevertheless -
        how difficult would it be to support IE8 (VML instead of SVG, lots of
        other differences/missing features) and possibly Safari/Chrome (only
        if no special case code needed for these)?
      - start automating tests prior to release, so that we have a chance
        of seeing what might be missing when things fail silently with other
        browsers/versions/oss 
      - factor sub-module loading from .xhtml to .js, automate dependency
        representation and computation (there seem to be several competing
        approaches for this floating around..)
      - long-term, we want to move away from graph editing; until then, there
        are lots of small improvements that would help to reduce the amount
        of manual graphical fiddling needed:
          - multiple element selections
          - move/copy/align/delete groups of elements
          - alignment help during element move
          - add new alternating nodes when arc targets are on empty ground,
            so that we can quickly lay down base lines
          ..
        also, graph traversals and group operations could help with
        repetitive tasks, such as 
          - renaming all elements in a copy
          - adjusting attributes in a group of elements
          - search&replace
          ..

}}}

