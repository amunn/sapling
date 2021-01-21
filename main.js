const SpatialSize = 200

function preload()
{
    SaplingSprite = loadImage("sapling.png")
    TitleSprite = loadImage("title.png")
    NewSprite = loadImage("new.png")
    LoadSprite = loadImage("open.png")
    CameraSprite = loadImage("camera.png")
    SaveSprite = loadImage("save.png")
    UndoSprite = loadImage("undo.png")
    RedoSprite = loadImage("redo.png")
    NoUndoSprite = loadImage("noundo.png")
    NoRedoSprite = loadImage("noredo.png")
    InfoSprite = loadImage("info.png")
    TipSprite = loadImage("tips.png")
}

function setup()
{
    Canvas = createCanvas()
    Canvas.style("display","block")
    AutoResizeCanvas()
    Reset()
    Tutorial = false
    let treeBackup = getItem("treeBackup")
    if (treeBackup)
    {
        LoadTreeRepresentation(treeBackup)
    }
    else
    {
        Tutorial = true
    }

    UndoList = []
    UndoIndex = 0
    MostCurrentUndoIndex = 0
    AddChange(true)

    FileInput = createFileInput(function (file) {
        print(file.data)
        LoadTreeRepresentation(file.data)
    })
    FileInput.position(180,90)
    FileInput.size(40,40)
    FileInput.style("font-size", "0px")
    FileInput.style("opacity", "0")

    const tipLink = createA("https://www.paypal.me/groverburger", "tip me!")
    tipLink.position(480,90)
    tipLink.size(40,40)
    tipLink.style("opacity", "0")

    RefreshCount = 0
}

function ScreenRefresh()
{
    ShouldScreenRefresh = true
}

function Reset()
{
    CurrentNodeID = 0
    TreeHasChanged = false
    SpatialHash = {}
    let tree = new TreeNode(0,0, "root")
    AddToSpatialHash(tree.x,tree.y, tree)
    tree.recalculate()
    Trees = [tree]
    Camera = {x:0, y:-50, zoom:1.25}
    CurrentMouseButton = -1
    Mouse = {x:0, y:0}
    PreviousMouseButton = -1
    SelectionList = {}
    NextSelectionList = {}
    ShouldScreenRefresh = true
    MouseHoveringNode = null
    CurrentContextMenu = null
    CurrentRenderTarget = null
    TreeRepresentation = null
    FontSize = 18
    CurrentlyActiveArrows = []
    textSize(FontSize)
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// spatial
////////////////////////////////////////////////////////////////////////////////////////////////////

function GetSpatialString(x,y)
{
    return Math.floor(x/SpatialSize) + ", " + Math.floor(y/SpatialSize)
}

function GetSpatialHash(x,y)
{
    let str = GetSpatialString(x,y)
    if (SpatialHash[str])
        return SpatialHash[str]
}

function AddToSpatialHash(x,y, thing)
{
    let str = GetSpatialString(x,y)
    //console.log(str, SpatialHash[str])
    if (!SpatialHash[str])
        SpatialHash[str] = []
    SpatialHash[str].push(thing)
}

function RemoveFromSpatialHash(x,y, thing)
{
    let str = GetSpatialString(x,y)
    if (!SpatialHash[str])
        return

    let i = 0
    while (i<SpatialHash[str].length)
    {
        if (SpatialHash[str][i] === thing)
        {
            SpatialHash[str].splice(i,1)
            return
        }
        i++
    }
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// api events
////////////////////////////////////////////////////////////////////////////////////////////////////

window.addEventListener("contextmenu", function() { arguments[0].preventDefault(); }, false);

document.addEventListener("keydown", function(e) {
    if (e.metaKey || e.ctrlKey)
    {
        if (e.keyCode === 83)
        {
            e.preventDefault()
            SaveFile()
        }

        if (e.keyCode === 65 || e.keyCode === 90)
        {
            e.preventDefault()
        }
    }

    if (e.keyCode === 9)
        e.preventDefault()

}, false);

document.addEventListener("paste", function(event) {
    // cancel original event
    event.preventDefault()

    // get text representation of clipboard
    let text = event.clipboardData.getData("text/plain");

    for (const key in SelectionList)
    {
        let node = SelectionList[key]
        if (node)
        {
            node.paste(text)
        }
    }
})

/*
document.addEventListener("copy", function(event) {
    // cancel original event
    event.preventDefault()

    // get text representation of clipboard
    let text = event.clipboardData.getData("text/plain");

    for (const key in SelectionList)
    {
        let node = SelectionList[key]
        if (node)
        {
            let textArea = document.createElement("textarea")
            textArea.value = node.text
            textArea.style.position = "fixed"
            document.body.appendChild(textArea)
            textArea.focus()
            textArea.select()
            print(document.execCommand("copy"))
            document.body.removeChild(textArea)
        }
    }
})
*/

function SaveFile()
{
    saveJSON(GetTreeRepresentation(Trees[0]), "myTree.json")
}

function windowResized()
{
    AutoResizeCanvas()
    ScreenRefresh()
}

function AutoResizeCanvas()
{
    resizeCanvas(windowWidth, windowHeight)
}

function mouseWheel(event)
{
    let scaleAmount = 1.05

    if (event.delta > 0)
    {
        Camera.zoom /= scaleAmount
        ScreenRefresh()
    }

    if (event.delta < 0)
    {
        Camera.zoom *= scaleAmount
        ScreenRefresh()
    }
}

function keyTyped()
{
    for (const index in SelectionList)
    {
        if (SelectionList[index])
            SelectionList[index].keyTyped(key)
    }
}

function keyPressed()
{
    NextSelectionList = Object.assign({}, SelectionList)

    for (const index in SelectionList)
    {
        if (SelectionList[index])
            SelectionList[index].keyPressed(keyCode)
    }

    SelectionList = NextSelectionList

    if (ModifierKey() || keyIsDown(16))
        AttemptAddChange()

    // apostrophe brings up quick search on firefox, block it here but still send the keyTyped
    if (keyCode == 222)
    {
        keyTyped("'")
        return false
    }

    // backspace and enter
    if (keyCode == 8 || keyCode == 13)
        return false

    // copying
    if (keyCode == 67 && ModifierKey())
        return false

    // z for undo/redo
    if (keyCode == 90 && ModifierKey())
    {
        if (keyIsDown(16))
            RedoChange()
        else
            UndoChange()
    }

    // ctrl - shift - 8 for clearing cache
    if (keyCode == 56 && ModifierKey() && keyIsDown(16))
    {
        clearStorage()
    }
}

function ModifierKey()
{
    return keyIsDown(17) || keyIsDown(18) || keyIsDown(224)
}

function mousePressed()
{
    if (CurrentContextMenu)
        CurrentContextMenu.mousePressed()
}

////////////////////////////////////////////////////////////////////////////////////////////////////
// main loops
////////////////////////////////////////////////////////////////////////////////////////////////////

function draw()
{
    Update()
    Draw()
}

function Update()
{
    if (mouseIsPressed)
        CurrentMouseButton = mouseButton
    else
        CurrentMouseButton = -1

    if (CurrentContextMenu)
    {
        CurrentContextMenu.update()
        return
    }

    // update the mouse world coordinates
    let lastMouseX = Mouse.x
    let lastMouseY = Mouse.y
    Mouse.x = Conversion(windowWidth/(-2*Camera.zoom) - Camera.x, windowWidth/(2*Camera.zoom) - Camera.x, 0, windowWidth, mouseX)
    Mouse.y = Conversion(windowHeight/(-2*Camera.zoom) - Camera.y, windowHeight/(2*Camera.zoom) - Camera.y, 0, windowHeight, mouseY)

    // look at all the nodes near spatially to the mouse cursor
    // check if hovering over them
    let lastMouseHoveringNode = MouseHoveringNode
    let clickedANode = false
    let manipulatingArrows = false
    for (let x=-1; x<=1; x++)
    {
        for (let y=-1; y<=1; y++)
        {
            let spatial = GetSpatialHash(Mouse.x + x*SpatialSize,Mouse.y + y*SpatialSize)
            if (spatial)
            {
                for (let i=0; i<spatial.length; i++)
                {
                    let node = spatial[i]
                    if (node.isHovered())
                    {
                        MouseHoveringNode = node
                        if (lastMouseHoveringNode !== MouseHoveringNode)
                            ScreenRefresh()

                        if (CurrentMouseButton === LEFT)
                        {
                            // remove all other nodse from the selection list if not holding shift
                            if (!keyIsDown(16) || true)
                            {
                                SelectionList = {}
                            }

                            // add this node
                            SelectionList[node.id] = node
                            clickedANode = true

                            ScreenRefresh()

                            for (let a=0; a<CurrentlyActiveArrows.length; a++)
                                CurrentlyActiveArrows[a].anchor(node)
                        }

                        // right click to open the context menu
                        if (CurrentMouseButton === RIGHT && PreviousMouseButton === -1)
                        {
                            clickedANode = true
                            let contextData = [
                                ["Add Subnode", [
                                    ["Single", function () { node.addChild(1) }],
                                    ["Double", function () { node.addChild(2) }],
                                    ["Triple", function () { node.addChild(3) }],
                                    ["Quadruple", function () { node.addChild(4) }],
                                    ["Quintuple", function () { node.addChild(5) }],
                                ]],
                                ["Change Color", [
                                    ["Default", function () { node.color = "default"; AddChange() } ],
                                    ["Highlighter", function () { node.color = "highlighter"; AddChange() } ],
                                    ["Blue", function () { node.color = "blue"; AddChange() } ],
                                    ["Red", function () { node.color = "red"; AddChange() } ],
                                    ["Green", function () { node.color = "green"; AddChange() } ],
                                    ["Dark", function () { node.color = "dark"; AddChange() } ],
                                ]],
                                ["Arrows", [
                                    ["Add", function () {
                                        let arrow = new Arrow(node)
                                        node.arrows.push(arrow)
                                        CurrentlyActiveArrows.push(arrow)
                                    }],
                                    ["Remove All", function () {
                                        node.arrows = []
                                        AddChange()
                                    }],
                                ]],
                                ["Reorder", [
                                    ["Left", function () { node.moveLeft(); AttemptAddChange()} ],
                                    ["Right", function () { node.moveRight(); AttemptAddChange()} ],
                                    ["Promote", function () { node.moveUp(); AttemptAddChange() } ],
                                ]],
                                ["Add Parent", function () {
                                    node.addParent()
                                    AddChange()
                                }],
                            ]

                            if (node.parent)
                            {
                                contextData.push(["Delete", function () {
                                    node.delete()
                                    AddChange()
                                }])
                            }

                            if (node.children.length > 0)
                            {
                                contextData.push(["Delete All Subnodes", function () {
                                    while (node.children.length > 0)
                                        node.children[0].delete()

                                    AddChange()
                                }])
                            }

                            CurrentContextMenu = new ContextMenu(mouseX, mouseY, contextData)
                        }
                    }
                }
            }
        }
    }

    for (const nodeid in SelectionList)
    {
        let node = SelectionList[nodeid]

        if (node && node.arrows.length > 0)
        {
            for (let a=0; a<node.arrows.length; a++)
            {
                let arrow = node.arrows[a]
                if (arrow.to)
                {
                    if ((arrow.hoveringPointOne() !== arrow.wasHoveringPointOne)
                    ||  (arrow.hoveringPointTwo() !== arrow.wasHoveringPointTwo))
                    {
                        ScreenRefresh()
                        clickedANode = true
                        manipulatingArrows = true
                    }

                    if (CurrentMouseButton === LEFT)
                    {
                        if (arrow.hoveringPointTwo())
                            arrow.manipulatingP2 = true
                        if (arrow.hoveringPointOne())
                            arrow.manipulatingP1 = true
                    }
                    else
                    {
                        arrow.manipulatingP1 = false
                        arrow.manipulatingP2 = false
                    }

                    if (arrow.manipulatingP2)
                    {
                        arrow.xoff2 = Mouse.x - arrow.to.x
                        arrow.yoff2 = Mouse.y - arrow.to.y - arrow.to.textHeight()/2 - 5
                        manipulatingArrows = true
                        clickedANode = true
                        ScreenRefresh()
                        TreeHasChanged = true
                    }

                    if (arrow.manipulatingP1)
                    {
                        arrow.xoff1 = Mouse.x - arrow.from.x
                        arrow.yoff1 = Mouse.y - arrow.from.y - arrow.to.textHeight()/2 - 5
                        manipulatingArrows = true
                        clickedANode = true
                        ScreenRefresh()
                        TreeHasChanged = true
                    }

                    arrow.wasHoveringPointOne = arrow.hoveringPointOne()
                    arrow.wasHoveringPointTwo = arrow.hoveringPointTwo()
                }
            }
        }
    }

    if (!manipulatingArrows)
        UpdateCamera()

    if (PreviousMouseButton !== LEFT && CurrentMouseButton === LEFT && !clickedANode)
    {
        SelectionList = {}
        ScreenRefresh()
    }

    // to make trivial changes like text additions happen
    if (PreviousMouseButton !== CurrentMouseButton)
        AttemptAddChange()

    let i = 0
    while (i < CurrentlyActiveArrows.length)
    {
        CurrentlyActiveArrows[i].update()
        if (CurrentlyActiveArrows[i].to)
            CurrentlyActiveArrows.splice(i,1)
        else
            i += 1
    }

    // if i was hovering a node but i'm not anymore, refresh the screen
    if (MouseHoveringNode && !MouseHoveringNode.isHovered())
    {
        MouseHoveringNode = null
        ScreenRefresh()
    }

    if (CurrentMouseButton === LEFT && PreviousMouseButton === -1)
    {
        PreviousMouseButton = CurrentMouseButton

        if (InHitbox(mouseX,mouseY, 130,90,40,40))
        {
            //AddChange()
            Reset()
        }

        if (InHitbox(mouseX,mouseY, 130 + 50*2,90,40,40))
            SaveFile()

        if (InHitbox(mouseX,mouseY, 130 + 50*3,90,40,40))
            Trees[0].takePicture()

        if (InHitbox(mouseX,mouseY, 130 + 50*4,90,40,40))
            UndoChange()

        if (InHitbox(mouseX,mouseY, 130 + 50*5,90,40,40))
            RedoChange()

        if (InHitbox(mouseX,mouseY, 130 + 50*6,90,40,40))
        {
alert(`Sapling v3.0
============

By Zach Booth, December 2020
Created for making syntax trees in Jorge Hankamer's Syntax 1 class, UCSC Fall 2020

-- Basics --

Click on a node to select it.
Type to edit text in a selected node.
Right click a node to open the node's options menu.
Click and drag to move the camera, scroll to zoom in and out.

-- Hotkeys --

CTRL+Z - Undo
Shift+CTRL+Z - Redo
CTRL+A - Adds a subnode beneath the selected node
Delete - Deletes the currently selected node
CTRL+Delete - Deletes all text in the currently selected node
Arrow Keys - Move selection around between nodes
Tab - Select the sibling to the right of the currently selected node
Shift+Tab - Select the sibling to the left of the currently selected node
Shift+Arrow Keys - Reorder the currently selected node
`)
        }

        /*
        if (InHitbox(mouseX,mouseY, 130 + 50*7,90,40,40))
        {
            window.open("https://www.paypal.me/groverburger", "_blank")
        }
    */
    }

    PreviousMouseButton = CurrentMouseButton
}

function Draw()
{
    if (!ShouldScreenRefresh) { return }
    ShouldScreenRefresh = false
    RefreshCount++

    background(200,200,200)
    push()
    translate(windowWidth/2, windowHeight/2)
    scale(Camera.zoom)
    translate(Camera.x, Camera.y)

    for (let i=0; i<Trees.length; i++)
    {
        Trees[i].draw()
    }

    for (const key in SelectionList)
    {
        if (SelectionList[key])
            SelectionList[key].draw(true)
    }

    if (Tutorial)
    {
        textAlign(CENTER)
        fill(120)
        text("Right click \"root\" to start!", 0,100)
        textAlign(LEFT)
    }

    pop()

    if (CurrentContextMenu)
        CurrentContextMenu.draw()

    noStroke()
    fill(0)
    textAlign(LEFT)
    //text(Math.floor(Mouse.x) + ", " + Math.floor(Mouse.y), 50,50)
    image(SaplingSprite, 10,10)
    image(NewSprite, 130,90, 40,40)
    image(LoadSprite, 130 + 50,90, 40,40)
    image(SaveSprite, 130 + 50*2,90, 40,40)
    image(CameraSprite, 130 + 50*3,90, 40,40)
    if (UndoIndex > 1)
        image(UndoSprite, 130 + 50*4,90, 40,40)
    else
        image(NoUndoSprite, 130 + 50*4,90, 40,40)

    if (UndoIndex < MostCurrentUndoIndex)
        image(RedoSprite, 130 + 50*5,90, 40,40)
    else
        image(NoRedoSprite, 130 + 50*5,90, 40,40)

    image(InfoSprite, 130 + 50*6,90, 40,40)
    image(TipSprite, 130 + 50*7,90, 40,40)

    image(TitleSprite, 120,30)
    //let rot = RefreshCount*Math.PI*0.1
    //arc(windowWidth-60,50, 30,30, rot,rot+Math.PI*1.5)
}

function UpdateCamera()
{
    if (CurrentMouseButton === LEFT || CurrentMouseButton === CENTER)
    {
        let lastCameraX = Camera.x
        let lastCameraY = Camera.y

        Camera.x += movedX/Camera.zoom
        Camera.y += movedY/Camera.zoom

        if (Camera.x != lastCameraX || Camera.y != lastCameraY)
            ScreenRefresh()
    }
}

function GetCurrentRenderTarget()
{
    return CurrentRenderTarget
}

function SetCurrentRenderTarget(target)
{
    CurrentRenderTarget = target
    if (target)
    {
        target.textSize(FontSize)
    }
}

function Clamp(n, min,max) { return Math.max(Math.min(n, max),min) }
function Lerp(a,b,t) { return (1-t)*a + t*b }
function Conversion(a,b, p1,p2, t) { return Lerp(a,b, Clamp((t-p1)/(p2-p1), 0,1)) }
function Distance(x1,y1, x2,y2) { return Math.sqrt(Math.pow(x1-x2,2) + Math.pow(y1-y2,2)) }

function InHitbox(x,y, x1,y1, width,height)
{
    return x >= x1 && x <= x1+width && y >= y1 && y <= y1 + height
}
