// ============================================================
//  HALFTONE PRO  by Petra-dot
//  Adobe Illustrator CS6 / CC 2019+   |   ExtendScript ES3
//
//  CHANGELOG
//  ─────────────────────────────────────────────────────────
//  v1.0  Initial release.
//        Core halftone engine: 6 shape types, rotated grid,
//        luma-driven dot sizing, gap control, clip mask,
//        flat/multi/gradient color modes, 15 presets,
//        dynamics (rotation, opacity, flip), two-column UI.
//
//  v2.0  Major feature update.
//        + Gradient color map: per-dot position-sampled solid
//          color across 2 or 3-stop gradients, 6 directions.
//        + Gap/spacing slider independent of cell size.
//        + Keep/remove source shape option.
//        + Layer always placed below active layer.
//        + Luma computed from actual canvas position (wx, wy)
//          instead of grid indices — fixes uneven distribution
//          at rotated angles.
//        + Clip mask structure rebuilt: single clean group,
//          no double-mask bug.
//        + CS6 compatibility fixes (Transformation.CENTER
//          removed, doc.selection=[] not null, etc.).
//
//  v3.0  Stability and correctness overhaul.
//        + Shapes outside bounds fixed: exact cull (dot centre
//          must be strictly inside bounds) replaces the old
//          half-cell margin that allowed overflow.
//        + Auto-clip rect added for artboard mode (no selection)
//          so shapes never overflow the artboard edge.
//        + Source shape removal timing fixed: item removed at
//          the START of generate() before new objects are
//          created, preventing stale reference invalidation.
//        + Color mode radio preset bug fixed: target radio set
//          TRUE first before others set false, preventing
//          ScriptUI auto-reselect of the wrong button.
//        + All radio groups use setRadio() helper for reliable
//          programmatic selection across all AI versions.
//        + C1 color slot always visible and enabled in Flat
//          mode so the primary color is always editable.
//        + pClr.layout.resize() forces color panel repaint
//          after mode switch.
//        + Hex Honeycomb preset corrected to Uniform sizing.
//
//  v3.1  Current version.
//        + Window title updated to "by Petra-dot".
//        + Version constants introduced (BRAND, VERSION, TITLE).
//        + Changelog consolidated to clean 3-version history.
// ============================================================

#target illustrator

var BRAND      = "Halftone Pro  by Petra-dot";
var VERSION    = "3.1";
var TITLE      = BRAND + "  v" + VERSION;
var MAX_SHAPES = 60000;

var SHAPE_LABELS = ["Circle","Square","Triangle","Hexagon","Diamond","Line"];
var BLEND_LABELS = ["Normal","Multiply","Screen","Overlay","Soft Light","Hard Light","Darken","Lighten"];
var BLEND_KEYS   = ["NORMAL","MULTIPLY","SCREEN","OVERLAY","SOFTLIGHT","HARDLIGHT","DARKEN","LIGHTEN"];
var SRC_LABELS   = ["Uniform","Diagonal","Linear L-R","Radial (edge dark)"];
var GDIR_LABELS  = ["Horizontal L-R","Horizontal R-L","Vertical T-B","Vertical B-T","Diagonal TL-BR","Radial outward"];

// ─────────────────────────────────────────────────────────────
//  PRESETS
// ─────────────────────────────────────────────────────────────
var PRESETS = [
  null,
  {name:"Classic Newspaper",
   shapeIdx:0,cellSize:20,gapPct:8,minScale:8,maxScale:92,angle:45,
   srcIdx:1,invert:false,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#1A1A1A","#444444","#777777","#AAAAAA","#DDDDDD"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.35},

  {name:"Fine Art Screen",
   shapeIdx:0,cellSize:10,gapPct:10,minScale:6,maxScale:88,angle:45,
   srcIdx:1,invert:false,gamma:1.1,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#000000","#333333","#666666","#999999","#CCCCCC"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.35},

  {name:"Coarse Pop-Art",
   shapeIdx:0,cellSize:36,gapPct:5,minScale:10,maxScale:96,angle:45,
   srcIdx:1,invert:false,gamma:1.4,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#CC0000","#FF4400","#0066FF","#00CC44","#FF9900"],cOn:[true,false,false,false,false],
   gs1:"#CC0000",gs2:"#FFCCCC",gs3:"#FF0000",g3:false,gDir:0,lw:0.35},

  {name:"Gradient Wash",
   shapeIdx:0,cellSize:18,gapPct:10,minScale:10,maxScale:90,angle:45,
   srcIdx:0,invert:false,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:2,colors:["#000000","#0066FF","#FF0000","#00CC44","#FF9900"],cOn:[true,false,false,false,false],
   gs1:"#0D0D2B",gs2:"#C0392B",gs3:"#F1C40F",g3:true,gDir:0,lw:0.35},

  {name:"Square Grid",
   shapeIdx:1,cellSize:22,gapPct:20,minScale:25,maxScale:75,angle:0,
   srcIdx:1,invert:false,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#000000","#333333","#666666","#999999","#CCCCCC"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.35},

  {name:"Diamond Editorial",
   shapeIdx:4,cellSize:20,gapPct:12,minScale:12,maxScale:88,angle:45,
   srcIdx:1,invert:false,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:2,colors:["#000000","#222244","#AAAACC","#DDDDEE","#FFFFFF"],cOn:[true,false,false,false,false],
   gs1:"#1C1C2E",gs2:"#C9A84C",gs3:"#FFFFFF",g3:false,gDir:4,lw:0.35},

  {name:"Hex Honeycomb",
   shapeIdx:3,cellSize:18,gapPct:6,minScale:82,maxScale:82,angle:0,
   srcIdx:0,invert:false,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#222222","#444444","#666666","#888888","#AAAAAA"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.35},

  {name:"Engraving Lines",
   shapeIdx:5,cellSize:16,gapPct:0,minScale:15,maxScale:85,angle:0,
   srcIdx:1,invert:false,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#000000","#333333","#666666","#999999","#CCCCCC"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.28},

  {name:"Radial Burst",
   shapeIdx:0,cellSize:18,gapPct:10,minScale:5,maxScale:94,angle:0,
   srcIdx:3,invert:true,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#000000","#333333","#666666","#999999","#CCCCCC"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:5,lw:0.35},

  {name:"Risograph",
   shapeIdx:1,cellSize:16,gapPct:14,minScale:40,maxScale:78,angle:15,
   srcIdx:0,invert:false,gamma:1.0,randSize:false,
   randRot:true,minRot:-8,maxRot:8,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:1,colors:["#E8303A","#1C4FA0","#F5A623","#2ECC71","#9B59B6"],cOn:[true,true,false,false,false],
   gs1:"#E8303A",gs2:"#1C4FA0",gs3:"#F5A623",g3:false,gDir:0,lw:0.35},

  {name:"Scatter Pop",
   shapeIdx:0,cellSize:20,gapPct:5,minScale:15,maxScale:78,angle:0,
   srcIdx:0,invert:false,gamma:1.0,randSize:true,
   randRot:true,minRot:-45,maxRot:45,randOpa:true,minOpa:55,maxOpa:100,flip:false,
   cMode:1,colors:["#FF2020","#FFD700","#0044FF","#00CC44","#FF9900"],cOn:[true,true,true,false,false],
   gs1:"#FF2020",gs2:"#FFD700",gs3:"#0044FF",g3:false,gDir:0,lw:0.35},

  {name:"Offset Press",
   shapeIdx:0,cellSize:22,gapPct:10,minScale:8,maxScale:90,angle:15,
   srcIdx:1,invert:false,gamma:1.1,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#1A1A1A","#333333","#666666","#999999","#CCCCCC"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.35},

  {name:"Micro Texture",
   shapeIdx:0,cellSize:7,gapPct:15,minScale:40,maxScale:80,angle:45,
   srcIdx:0,invert:false,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#333333","#555555","#777777","#999999","#BBBBBB"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.35},

  {name:"Brutalist",
   shapeIdx:0,cellSize:24,gapPct:0,minScale:20,maxScale:94,angle:0,
   srcIdx:0,invert:false,gamma:1.0,randSize:true,
   randRot:true,minRot:-180,maxRot:180,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#000000","#333333","#666666","#999999","#CCCCCC"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.35},

  {name:"Triangle Mesh",
   shapeIdx:2,cellSize:22,gapPct:10,minScale:15,maxScale:86,angle:0,
   srcIdx:1,invert:false,gamma:1.0,randSize:false,
   randRot:false,minRot:-45,maxRot:45,randOpa:false,minOpa:60,maxOpa:100,flip:false,
   cMode:0,colors:["#000000","#333333","#666666","#999999","#CCCCCC"],cOn:[true,false,false,false,false],
   gs1:"#000000",gs2:"#FFFFFF",gs3:"#888888",g3:false,gDir:0,lw:0.35}
];

var PRESET_LABELS = ["-- Select preset --"];
for(var _pi=1;_pi<PRESETS.length;_pi++) PRESET_LABELS.push(PRESETS[_pi].name);

// ─────────────────────────────────────────────────────────────
//  DEFAULTS
// ─────────────────────────────────────────────────────────────
var D = {
    shapeIdx:0,cellSize:20,gapPct:10,minScale:20,maxScale:90,
    randSize:false,angle:45,lw:0.35,
    srcIdx:0,invert:false,gamma:1.0,
    randRot:false,minRot:-45,maxRot:45,
    randOpa:false,minOpa:60,maxOpa:100,flip:false,
    cMode:0,
    colors:["#000000","#FF0000","#0066FF","#00CC44","#FF9900"],
    cOn:[true,false,false,false,false],
    gs1:"#000000",gs2:"#FFFFFF",gs3:"#FF0000",g3:false,gDir:0,
    clip:true,keepSrc:false,group:true,blend:0,opacity:100
};

// ─────────────────────────────────────────────────────────────
//  UTILITIES
// ─────────────────────────────────────────────────────────────
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function rnd(lo,hi)     {return lo+Math.random()*(hi-lo);}
function d2r(d)          {return d*Math.PI/180;}

function hex2rgb(hex){
    hex=hex.replace(/^\s*#\s*/,"").replace(/\s/g,"");
    if(hex.length===3) hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    if(!/^[0-9a-fA-F]{6}$/.test(hex)) hex="000000";
    var c=new RGBColor();
    c.red  =parseInt(hex.substring(0,2),16);
    c.green=parseInt(hex.substring(2,4),16);
    c.blue =parseInt(hex.substring(4,6),16);
    return c;
}
function hex2obj(hex){var c=hex2rgb(hex);return{r:c.red,g:c.green,b:c.blue};}
function lerpRgb(a,b,t){
    t=clamp(t,0,1);
    var c=new RGBColor();
    c.red  =Math.round(a.r+(b.r-a.r)*t);
    c.green=Math.round(a.g+(b.g-a.g)*t);
    c.blue =Math.round(a.b+(b.b-a.b)*t);
    return c;
}
function sampleGrad(cfg,t){
    t=clamp(t,0,1);
    var a=hex2obj(cfg.gs1),b=hex2obj(cfg.gs2);
    if(!cfg.g3) return lerpRgb(a,b,t);
    var c=hex2obj(cfg.gs3);
    return t<=0.5?lerpRgb(a,b,t*2):lerpRgb(b,c,(t-0.5)*2);
}
function gradT(cfg,nx,ny){
    switch(cfg.gDir){
        case 0:return nx;
        case 1:return 1-nx;
        case 2:return ny;
        case 3:return 1-ny;
        case 4:return (nx+ny)*0.5;
        case 5:var dx=nx-0.5,dy=ny-0.5;return clamp(Math.sqrt(dx*dx+dy*dy)*2,0,1);
        default:return nx;
    }
}
function makeWhite(){var c=new RGBColor();c.red=255;c.green=255;c.blue=255;return c;}
function setBM(item,idx){try{item.blendingMode=BlendingMode[BLEND_KEYS[idx]||"NORMAL"];}catch(e){}}

// ─────────────────────────────────────────────────────────────
//  SHAPES
// ─────────────────────────────────────────────────────────────
function apFill(p,c){p.filled=true;p.fillColor=c;p.stroked=false;return p;}
function dCircle(l,cx,cy,r,c)  {return apFill(l.pathItems.ellipse(cy+r,cx-r,r*2,r*2),c);}
function dSquare(l,cx,cy,r,c)  {return apFill(l.pathItems.rectangle(cy+r,cx-r,r*2,r*2),c);}
function dTriangle(l,cx,cy,r,c){
    var s=0.8660254,p=l.pathItems.add();
    p.setEntirePath([[cx,cy+r],[cx+r*s,cy-r*0.5],[cx-r*s,cy-r*0.5]]);
    p.closed=true;return apFill(p,c);
}
function dHexagon(l,cx,cy,r,c){
    var pts=[],a;
    for(var i=0;i<6;i++){a=d2r(60*i+30);pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);}
    var p=l.pathItems.add();p.setEntirePath(pts);p.closed=true;return apFill(p,c);
}
function dDiamond(l,cx,cy,r,c){
    var p=l.pathItems.add();
    p.setEntirePath([[cx,cy+r],[cx+r,cy],[cx,cy-r],[cx-r,cy]]);
    p.closed=true;return apFill(p,c);
}
function dLine(l,cx,cy,r,wf,c){
    var hw=r*clamp(wf,0.05,1.0);
    return apFill(l.pathItems.rectangle(cy+r,cx-hw,hw*2,r*2),c);
}
function dShape(cfg,l,cx,cy,r,c){
    switch(cfg.shapeIdx){
        case 0:return dCircle  (l,cx,cy,r,c);
        case 1:return dSquare  (l,cx,cy,r,c);
        case 2:return dTriangle(l,cx,cy,r,c);
        case 3:return dHexagon (l,cx,cy,r,c);
        case 4:return dDiamond (l,cx,cy,r,c);
        case 5:return dLine    (l,cx,cy,r,cfg.lw,c);
        default:return dCircle (l,cx,cy,r,c);
    }
}

// ─────────────────────────────────────────────────────────────
//  COLOR
// ─────────────────────────────────────────────────────────────
function buildPool(cfg){
    if(cfg.cMode===0) return [hex2rgb(cfg.colors[0])];
    if(cfg.cMode===1){
        var p=[];
        for(var i=0;i<5;i++) if(cfg.cOn[i]) p.push(hex2rgb(cfg.colors[i]));
        return p.length>0?p:[hex2rgb("#000000")];
    }
    return null;
}
function pickC(pool){return pool[Math.floor(Math.random()*pool.length)];}
function resolveC(cfg,pool,nx,ny){
    if(cfg.cMode===2) return sampleGrad(cfg,gradT(cfg,nx,ny));
    return pickC(pool);
}

// ─────────────────────────────────────────────────────────────
//  DYNAMICS
// ─────────────────────────────────────────────────────────────
function applyDyn(cfg,s){
    if(cfg.randRot) s.rotate(rnd(cfg.minRot,cfg.maxRot),true,false,false,false);
    if(cfg.randOpa) s.opacity=clamp(rnd(cfg.minOpa,cfg.maxOpa),0,100);
    if(cfg.flip){
        var v=Math.random();
        if(v<0.25) s.flipHorizontal();
        else if(v<0.5) s.flipVertical();
    }
}

// ─────────────────────────────────────────────────────────────
//  GROUP / CLIP
// ─────────────────────────────────────────────────────────────
function mkGroup(layer,shapes,name){
    var g=layer.groupItems.add();g.name=name;
    for(var i=0;i<shapes.length;i++) shapes[i].move(g,ElementPlacement.PLACEATBEGINNING);
    return g;
}
function mkClip(layer,sg,maskPath,name){
    try{
        var cg=layer.groupItems.add();cg.name=name;
        maskPath.move(cg,ElementPlacement.PLACEATBEGINNING);
        try{maskPath.filled=true;maskPath.fillColor=makeWhite();maskPath.stroked=false;maskPath.opacity=100;}catch(e){}
        sg.move(cg,ElementPlacement.PLACEATEND);
        cg.clipped=true;
        return cg;
    }catch(e){return sg;}
}

// ─────────────────────────────────────────────────────────────
//  CORE GENERATOR
// ─────────────────────────────────────────────────────────────
function generate(cfg){
    var doc=app.activeDocument;
    app.coordinateSystem=CoordinateSystem.ARTBOARDCOORDINATESYSTEM;

    var hasSel=(doc.selection&&doc.selection.length>0);
    var srcItem=hasSel?doc.selection[0]:null;

    // ── FIX [B]: Remove source shape NOW, before creating any new
    // objects. This guarantees srcItem is still a fresh, valid
    // reference. After layer/group creation the reference can
    // become stale on some AI versions.
    if(srcItem && !cfg.keepSrc){
        try{
            try{srcItem.layer.locked=false;}catch(e){}
            try{srcItem.locked=false;}catch(e){}
            // Store bounds before removing
        }catch(e){}
        // We need bounds first — capture before removal
    }

    // ── 1. Bounds ────────────────────────────────────────────
    var bounds, clipSource=null;

    if(hasSel){
        bounds=srcItem.geometricBounds; // [left,top,right,bottom]
        // Clone the source for the clip mask before any other changes
        if(cfg.clip){
            try{clipSource=srcItem.duplicate(srcItem.layer,ElementPlacement.PLACEATBEGINNING);}
            catch(e){clipSource=null;}
        }
        // FIX [B]: Now remove the source (bounds already captured above)
        if(!cfg.keepSrc){
            try{
                try{srcItem.layer.locked=false;}catch(e){}
                try{srcItem.locked=false;}catch(e){}
                srcItem.remove();
                srcItem=null;
            }catch(e){}
        }
    } else {
        // No selection — use active artboard
        var ab=doc.artboards[doc.artboards.getActiveArtboardIndex()];
        bounds=ab.artboardRect;
        // FIX [A] + [D]: When no selection, auto-create a clip rect from
        // the artboard so shapes never overflow beyond the artboard edge.
        if(cfg.clip){
            try{
                var abRect=doc.activeLayer.pathItems.rectangle(
                    bounds[1],bounds[0],
                    bounds[2]-bounds[0],
                    bounds[1]-bounds[3]
                );
                clipSource=abRect;
            }catch(e){clipSource=null;}
        }
    }

    var L=bounds[0], T=bounds[1], R=bounds[2], B=bounds[3];
    var W=R-L, H=T-B;   // H positive: AI top>bottom
    var mX=L+W*0.5, mY=B+H*0.5;

    // ── 2. Grid ──────────────────────────────────────────────
    var cell=cfg.cellSize;
    var half=cell*0.5;
    var gs=1.0-clamp(cfg.gapPct,0,80)/100.0;
    var aRad=d2r(cfg.angle);
    var cosA=Math.cos(aRad), sinA=Math.sin(aRad);

    // Diagonal extent covers all rotation angles
    var diag=Math.sqrt(W*W+H*H)*0.5+cell;
    var nC=Math.ceil(diag*2/cell)+2;
    var nR=Math.ceil(diag*2/cell)+2;

    var pool=buildPool(cfg);

    // ── 3. Layer ─────────────────────────────────────────────
    var prev=doc.activeLayer;
    var lName=SHAPE_LABELS[cfg.shapeIdx]+" Halftone "+cell+"pt "+cfg.angle+"deg";
    var htL;
    try{htL=doc.layers.add();htL.move(prev,ElementPlacement.PLACEAFTER);}
    catch(e){if(!htL)htL=doc.layers.add();}
    htL.name=lName;

    // ── 4. Draw loop ─────────────────────────────────────────
    var shapes=[],count=0,hit=false;

    for(var row=0;row<nR&&!hit;row++){
        for(var col=0;col<nC;col++){

            // Rotate grid position into document space
            var gx=(col-nC*0.5+0.5)*cell;
            var gy=(row-nR*0.5+0.5)*cell;
            var wx=mX+gx*cosA-gy*sinA;
            var wy=mY+gx*sinA+gy*cosA;

            // FIX [A]: Exact bounds cull — dot centre must be inside
            // the bounds exactly. The clip mask handles visual edge
            // trimming for both selection shapes and artboard clips.
            // No margin needed — any dot centre outside the bounds
            // belongs to a cell that is completely outside the area.
            if(wx<=L||wx>=R||wy<=B||wy>=T) continue;

            // Luma from actual canvas position
            var nx=clamp((wx-L)/W,0,1);
            var ny=clamp((T-wy)/H,0,1);
            var lv=0;
            if(cfg.srcIdx!==0){
                switch(cfg.srcIdx){
                    case 1:lv=(nx+ny)*0.5;break;
                    case 2:lv=nx;break;
                    case 3:var dx=nx-0.5,dy=ny-0.5;lv=clamp(Math.sqrt(dx*dx+dy*dy)*2,0,1);break;
                }
                lv=Math.pow(clamp(lv,0,1),cfg.gamma);
                if(cfg.invert) lv=1-lv;
            }

            // Dot radius
            var r;
            if(cfg.randSize){
                r=half*(rnd(cfg.minScale,cfg.maxScale)/100.0)*gs;
            }else{
                var sp=cfg.minScale+(1-lv)*(cfg.maxScale-cfg.minScale);
                r=half*(sp/100.0)*gs;
            }
            if(r<0.5) continue;

            var color=resolveC(cfg,pool,nx,ny);
            var shape=dShape(cfg,htL,wx,wy,r,color);
            if(!shape) continue;
            try{applyDyn(cfg,shape);}catch(e){}
            shapes.push(shape);count++;
            if(count>=MAX_SHAPES){hit=true;break;}
        }
    }

    // ── 5. Guard ─────────────────────────────────────────────
    if(shapes.length===0){
        if(clipSource) try{clipSource.remove();}catch(e){}
        htL.remove();
        return {count:-1};
    }

    // ── 6. Group + clip ──────────────────────────────────────
    var fName=lName+" ["+count+"]";
    var needGrp=cfg.group||cfg.clip;
    if(needGrp){
        var sg=mkGroup(htL,shapes,fName);
        setBM(sg,cfg.blend);
        sg.opacity=cfg.opacity;
        if(cfg.clip&&clipSource){
            mkClip(htL,sg,clipSource,fName+" clip");
        }else if(clipSource){
            try{clipSource.remove();}catch(e){}
        }
    }else{
        if(clipSource) try{clipSource.remove();}catch(e){}
        setBM(htL,cfg.blend);
        htL.opacity=cfg.opacity;
    }

    htL.name=fName;
    doc.selection=[];
    return {count:hit?-count:count};
}

// ─────────────────────────────────────────────────────────────
//  DIALOG
// ─────────────────────────────────────────────────────────────
function buildUI(){
    var dlg=new Window("dialog",TITLE);
    dlg.orientation="column";dlg.alignChildren=["fill","top"];dlg.margins=14;dlg.spacing=7;

    function row(parent,sp){
        var g=parent.add("group");
        g.orientation="row";g.alignChildren=["left","center"];g.spacing=sp||6;
        return g;
    }
    function lbl(p,t,w){var s=p.add("statictext",undefined,t);if(w)s.preferredSize.width=w;return s;}
    function cpnl(parent,title){
        var p=parent.add("panel",undefined,title);
        p.orientation="column";p.alignChildren=["fill","top"];p.margins=[10,14,10,8];p.spacing=5;
        return p;
    }
    function slider(parent,label,lo,hi,def,isFloat,lw){
        var rw=row(parent);lbl(rw,label,lw||100);
        var sl=rw.add("slider",undefined,def,lo,hi);sl.preferredSize.width=130;
        function fmt(v){return isFloat?parseFloat(v).toFixed(2):String(Math.round(v));}
        var et=rw.add("edittext",undefined,fmt(def));et.preferredSize.width=40;
        sl.onChanging=function(){et.text=fmt(sl.value);};
        et.onChange  =function(){var v=parseFloat(et.text);if(!isNaN(v))sl.value=clamp(v,lo,hi);};
        return{
            sl:sl,et:et,
            get:function(){var v=parseFloat(et.text);return isNaN(v)?sl.value:isFloat?v:Math.round(v);},
            set:function(v){sl.value=clamp(v,lo,hi);et.text=fmt(v);}
        };
    }
    function radioGroup(parent,labels,def,cb){
        var rs=[];
        for(var i=0;i<labels.length;i++) rs.push(parent.add("radiobutton",undefined,labels[i]));
        rs[Math.min(def,rs.length-1)].value=true;
        (function(){
            for(var i=0;i<rs.length;i++){
                (function(k){
                    rs[k].onClick=function(){
                        for(var j=0;j<rs.length;j++) rs[j].value=(j===k);
                        if(cb) cb(k);
                    };
                })(i);
            }
        }());
        return rs;
    }
    function getR(rs){for(var i=0;i<rs.length;i++) if(rs[i].value) return i; return 0;}

    // ── Presets ──────────────────────────────────────────────
    var pPre=cpnl(dlg,"Presets");
    var preRow=row(pPre,8);
    lbl(preRow,"",4);
    var ddPre=preRow.add("dropdownlist",undefined,PRESET_LABELS);
    ddPre.selection=0;ddPre.preferredSize.width=220;
    var btnPre=preRow.add("button",undefined,"Apply");btnPre.preferredSize.width=60;

    // ── Two-column layout ────────────────────────────────────
    var cols=dlg.add("group");
    cols.orientation="row";cols.alignChildren=["top","top"];cols.spacing=8;

    // LEFT
    var colL=cols.add("group");colL.orientation="column";colL.alignChildren=["fill","top"];colL.spacing=7;

    var pShp=cpnl(colL,"Shape");
    var shpR=radioGroup(pShp,SHAPE_LABELS,D.shapeIdx);
    var sLW=slider(pShp,"Line width:",0.05,1.0,D.lw,true,80);

    var pGrid=cpnl(colL,"Grid & Spacing");
    var sCell=slider(pGrid,"Cell size (pt):",4,80,D.cellSize,false,100);
    var sGap =slider(pGrid,"Gap %:",0,80,D.gapPct,false,100);
    var sMn  =slider(pGrid,"Min scale %:",0,100,D.minScale,false,100);
    var sMx  =slider(pGrid,"Max scale %:",0,100,D.maxScale,false,100);
    var sAng =slider(pGrid,"Angle (deg):",0,89,D.angle,false,100);
    var cbRS =pGrid.add("checkbox",undefined,"Random dot size");cbRS.value=D.randSize;

    var pSrc=cpnl(colL,"Dot Size Source");
    var srcR=radioGroup(pSrc,SRC_LABELS,D.srcIdx);
    var cbInv=pSrc.add("checkbox",undefined,"Invert");cbInv.value=D.invert;
    var sGam=slider(pSrc,"Gamma:",0.3,3.0,D.gamma,true,60);

    // RIGHT
    var colR=cols.add("group");colR.orientation="column";colR.alignChildren=["fill","top"];colR.spacing=7;

    var pDyn=cpnl(colR,"Dynamics");
    var cbRR=pDyn.add("checkbox",undefined,"Random rotation");cbRR.value=D.randRot;
    var sMnR=slider(pDyn,"Min (deg):",-180,0,D.minRot,false,70);
    var sMxR=slider(pDyn,"Max (deg):",0,180,D.maxRot,false,70);
    var cbRO=pDyn.add("checkbox",undefined,"Random opacity");cbRO.value=D.randOpa;
    var sMnO=slider(pDyn,"Min (%):",0,100,D.minOpa,false,70);
    var sMxO=slider(pDyn,"Max (%):",0,100,D.maxOpa,false,70);
    var cbFl=pDyn.add("checkbox",undefined,"Random flip H/V");cbFl.value=D.flip;
    function rfDyn(){
        var re=cbRR.value;sMnR.sl.enabled=re;sMnR.et.enabled=re;sMxR.sl.enabled=re;sMxR.et.enabled=re;
        var oe=cbRO.value;sMnO.sl.enabled=oe;sMnO.et.enabled=oe;sMxO.sl.enabled=oe;sMxO.et.enabled=oe;
    }
    cbRR.onClick=rfDyn;cbRO.onClick=rfDyn;rfDyn();

    // Color panel
    var pClr=cpnl(colR,"Color");
    var modeRow=row(pClr,4);
    var cmR=radioGroup(modeRow,["Flat","Multi","Gradient"],D.cMode,function(){rfClr();});

    var slotRow=pClr.add("group");slotRow.orientation="row";slotRow.spacing=6;
    var cCk=new Array(5),cEt=new Array(5);
    for(var ci=0;ci<5;ci++){
        var cg=slotRow.add("group");cg.orientation="column";cg.spacing=2;cg.alignChildren="center";
        cCk[ci]=cg.add("checkbox",undefined,"C"+(ci+1));cCk[ci].value=D.cOn[ci];
        cEt[ci]=cg.add("edittext",undefined,D.colors[ci]);cEt[ci].preferredSize.width=60;
    }

    var gr1=row(pClr,6);lbl(gr1,"Stop 1:",44);
    var etS1=gr1.add("edittext",undefined,D.gs1);etS1.preferredSize.width=70;
    lbl(gr1,"Stop 2:",44);
    var etS2=gr1.add("edittext",undefined,D.gs2);etS2.preferredSize.width=70;
    var gr2=row(pClr,6);
    var cb3=gr2.add("checkbox",undefined,"3-stop");cb3.value=D.g3;
    lbl(gr2,"Stop 3:",44);
    var etS3=gr2.add("edittext",undefined,D.gs3);etS3.preferredSize.width=70;
    var gr3=row(pClr,6);lbl(gr3,"Direction:",64);
    var ddGD=gr3.add("dropdownlist",undefined,GDIR_LABELS);
    ddGD.selection=D.gDir;ddGD.preferredSize.width=165;

    function rfClr(){
        var m=getR(cmR);
        for(var k=0;k<5;k++){
            cEt[k].enabled=(m===0&&k===0)||(m===1);
            if(m===0){
                cCk[k].enabled=(k===0);
                if(k===0) cCk[k].value=true;
            }else{
                cCk[k].enabled=(m===1);
            }
        }
        var g=(m===2);
        etS1.enabled=g;etS2.enabled=g;cb3.enabled=g;
        etS3.enabled=g&&cb3.value;ddGD.enabled=g;
        try{pClr.layout.resize();}catch(e){}
    }
    function rfS3(){etS3.enabled=cb3.value&&getR(cmR)===2;}
    cb3.onClick=rfS3;
    rfClr();

    // Output panel
    var pOut=cpnl(colR,"Output");
    var r1=row(pOut,10);
    var cbCl=r1.add("checkbox",undefined,"Clip mask");cbCl.value=D.clip;
    var cbKS=r1.add("checkbox",undefined,"Keep source shape");cbKS.value=D.keepSrc;
    var cbGr=row(pOut,10).add("checkbox",undefined,"Group shapes");cbGr.value=D.group;
    var r3=row(pOut,8);lbl(r3,"Blend:",50);
    var ddBl=r3.add("dropdownlist",undefined,BLEND_LABELS);
    ddBl.selection=D.blend;ddBl.preferredSize.width=110;
    var sOpa=slider(pOut,"Opacity %:",10,100,D.opacity,false,60);

    // ── Preset apply ─────────────────────────────────────────
    // FIX [C]: Set target radio TRUE first, then others FALSE.
    // This prevents ScriptUI from auto-selecting the first button
    // when the currently-true one is set false before the target.
    function setRadio(rs,idx){
        rs[idx].value=true;  // set target TRUE first
        for(var i=0;i<rs.length;i++) if(i!==idx) rs[i].value=false;
    }

    function applyP(p){
        if(!p) return;
        setRadio(shpR,p.shapeIdx);
        setRadio(srcR,p.srcIdx);
        sCell.set(p.cellSize);sGap.set(p.gapPct);
        sMn.set(p.minScale);sMx.set(p.maxScale);sAng.set(p.angle);
        sLW.set(p.lw);cbInv.value=p.invert;sGam.set(p.gamma);cbRS.value=p.randSize;
        cbRR.value=p.randRot;cbRO.value=p.randOpa;cbFl.value=p.flip;
        sMnR.set(p.minRot);sMxR.set(p.maxRot);
        sMnO.set(p.minOpa);sMxO.set(p.maxOpa);
        // FIX [C]: set color mode radio correctly
        setRadio(cmR,p.cMode);
        for(var k=0;k<5;k++){cEt[k].text=p.colors[k];cCk[k].value=p.cOn[k];}
        etS1.text=p.gs1;etS2.text=p.gs2;etS3.text=p.gs3;
        cb3.value=p.g3;ddGD.selection=p.gDir;
        rfDyn();rfClr();rfS3();
    }

    btnPre.onClick=function(){
        var idx=ddPre.selection?ddPre.selection.index:0;
        if(idx>0&&PRESETS[idx]) applyP(PRESETS[idx]);
        else alert("Please select a preset from the list first.");
    };

    // ── Reset + Buttons ──────────────────────────────────────
    var btnRow=dlg.add("group");btnRow.orientation="row";btnRow.alignment="right";btnRow.spacing=8;
    var btnRst=btnRow.add("button",undefined,"Reset");
    btnRow.add("button",undefined,"Cancel",{name:"cancel"});
    var btnOK=btnRow.add("button",undefined,"Generate  \u25ba",{name:"ok"});
    btnOK.active=true;

    btnRst.onClick=function(){
        ddPre.selection=0;
        setRadio(shpR,D.shapeIdx);setRadio(srcR,D.srcIdx);setRadio(cmR,D.cMode);
        sCell.set(D.cellSize);sGap.set(D.gapPct);sMn.set(D.minScale);sMx.set(D.maxScale);
        sAng.set(D.angle);sLW.set(D.lw);cbInv.value=D.invert;sGam.set(D.gamma);
        cbRS.value=D.randSize;cbRR.value=D.randRot;cbRO.value=D.randOpa;cbFl.value=D.flip;
        cbCl.value=D.clip;cbKS.value=D.keepSrc;cbGr.value=D.group;
        ddBl.selection=D.blend;sOpa.set(D.opacity);
        sMnR.set(D.minRot);sMxR.set(D.maxRot);sMnO.set(D.minOpa);sMxO.set(D.maxOpa);
        for(var k=0;k<5;k++){cEt[k].text=D.colors[k];cCk[k].value=D.cOn[k];}
        etS1.text=D.gs1;etS2.text=D.gs2;etS3.text=D.gs3;cb3.value=D.g3;ddGD.selection=D.gDir;
        rfDyn();rfClr();rfS3();
    };

    if(dlg.show()!==1) return null;

    function ch(raw){raw=raw.replace(/\s/g,"");if(raw.charAt(0)!=="#")raw="#"+raw;return raw;}
    var ca=[],ce=[];
    for(var i=0;i<5;i++){
        var h=cEt[i].text.replace(/\s/g,"");if(h.charAt(0)!=="#")h="#"+h;
        ca.push(h);ce.push(cCk[i].value);
    }
    ce[0]=true;

    return{
        shapeIdx:getR(shpR),cellSize:sCell.get(),gapPct:sGap.get(),
        minScale:sMn.get(),maxScale:sMx.get(),randSize:cbRS.value,
        angle:sAng.get(),lw:sLW.get(),
        srcIdx:getR(srcR),invert:cbInv.value,gamma:sGam.get(),
        randRot:cbRR.value,minRot:sMnR.get(),maxRot:sMxR.get(),
        randOpa:cbRO.value,minOpa:sMnO.get(),maxOpa:sMxO.get(),flip:cbFl.value,
        cMode:getR(cmR),colors:ca,cOn:ce,
        gs1:ch(etS1.text),gs2:ch(etS2.text),gs3:ch(etS3.text),
        g3:cb3.value,gDir:ddGD.selection?ddGD.selection.index:0,
        clip:cbCl.value,keepSrc:cbKS.value,group:cbGr.value,
        blend:ddBl.selection?ddBl.selection.index:0,opacity:sOpa.get()
    };
}

// ─────────────────────────────────────────────────────────────
//  ENTRY POINT
// ─────────────────────────────────────────────────────────────
function main(){
    if(!app.documents.length){alert("Please open an Illustrator document first.");return;}
    var cfg=buildUI();
    if(!cfg) return;
    if(cfg.minScale>cfg.maxScale){alert("Min scale must not exceed Max scale.");return;}

    var t0=+new Date();
    try{
        app.userInteractionLevel=UserInteractionLevel.DONTDISPLAYALERTS;
        var res=generate(cfg);
        app.userInteractionLevel=UserInteractionLevel.DISPLAYALERTS;

        if(res.count===-1){
            alert("No shapes generated.\nTry: smaller cell size, lower min scale, or reduce gap %.");
        }else{
            var n=Math.abs(res.count);
            var sec=(((+new Date())-t0)/1000).toFixed(1);
            var cmStr=["Flat","Multi","Gradient"][cfg.cMode]||"Flat";
            var msg=BRAND+"  v"+VERSION+"  —  Done\n\n"
               +"Shapes : "+n+"    Type: "+SHAPE_LABELS[cfg.shapeIdx]+"\n"
               +"Cell   : "+cfg.cellSize+"pt    Gap: "+cfg.gapPct+"%    Angle: "+cfg.angle+"deg\n"
               +"Color  : "+cmStr+"    Time: "+sec+"s";
            if(res.count<0) msg+="\n\nWARNING: shape limit reached. Increase cell size.";
            alert(msg);
        }
    }catch(err){
        app.userInteractionLevel=UserInteractionLevel.DISPLAYALERTS;
        alert("Error: "+err.message+"\n(line "+err.line+")");
    }
}

main();