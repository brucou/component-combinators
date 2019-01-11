Creator	"yFiles"
Version	"2.14"
graph
[
	hierarchic	1
	label	""
	directed	1
	node
	[
		id	0
		label	"Legend"
		graphics
		[
			x	681.0086599817686
			y	469.82680036463074
			w	270.1595259799453
			h	148.88969917958073
			type	"rectangle"
			fill	"#FFFFFFE6"
			fill2	"#D4D4D4CC"
			outline	"#123EA2"
			topBorderInset	12.054694621695603
			bottomBorderInset	8.72926162260714
			leftBorderInset	4.500455788514145
			rightBorderInset	108.4922515952598
		]
		LabelGraphics
		[
			text	"Legend"
			fontSize	12
			fontName	"Dialog"
			model	"null"
		]
		isGroup	1
	]
	node
	[
		id	1
		label	"A"
		graphics
		[
			x	577.9170464904286
			y	434.436645396536
			w	24.0
			h	24.0
			type	"roundrectangle"
			raisedBorder	0
			fill	"#FFCC00"
			outline	"#000000"
		]
		LabelGraphics
		[
			text	"A"
			fontSize	12
			fontName	"Dialog"
			anchor	"c"
		]
		gid	0
	]
	node
	[
		id	2
		label	"B"
		graphics
		[
			x	680.5961713764814
			y	435.0888787602552
			w	24.0
			h	24.0
			type	"roundrectangle"
			raisedBorder	0
			fill	"#FFCC00"
			outline	"#000000"
		]
		LabelGraphics
		[
			text	"B"
			fontSize	12
			fontName	"Dialog"
			anchor	"c"
		]
		gid	0
	]
	node
	[
		id	3
		label	"A"
		graphics
		[
			x	577.4293527803101
			y	470.30720145852314
			w	24.0
			h	24.0
			type	"roundrectangle"
			raisedBorder	0
			fill	"#FFCC00"
			outline	"#000000"
		]
		LabelGraphics
		[
			text	"A"
			fontSize	12
			fontName	"Dialog"
			anchor	"c"
		]
		gid	0
	]
	node
	[
		id	4
		label	"B"
		graphics
		[
			x	680.1084776663629
			y	470.9594348222425
			w	24.0
			h	24.0
			type	"roundrectangle"
			raisedBorder	0
			fill	"#FFCC00"
			outline	"#000000"
		]
		LabelGraphics
		[
			text	"B"
			fontSize	12
			fontName	"Dialog"
			anchor	"c"
		]
		gid	0
	]
	node
	[
		id	5
		label	"A"
		graphics
		[
			x	577.7010027347312
			y	508.54238833181404
			w	24.0
			h	24.0
			type	"roundrectangle"
			raisedBorder	0
			fill	"#FFCC00"
			outline	"#000000"
		]
		LabelGraphics
		[
			text	"A"
			fontSize	12
			fontName	"Dialog"
			anchor	"c"
		]
		gid	0
	]
	node
	[
		id	6
		label	"B"
		graphics
		[
			x	680.3801276207842
			y	507.94758432087514
			w	24.0
			h	24.0
			type	"roundrectangle"
			raisedBorder	0
			fill	"#FFCC00"
			outline	"#000000"
		]
		LabelGraphics
		[
			text	"B"
			fontSize	12
			fontName	"Dialog"
			anchor	"c"
		]
		gid	0
	]
	node
	[
		id	7
		label	"Legend"
		graphics
		[
			x	686.8359375
			y	276.33333333333337
			w	282.328125
			h	117.73567708333331
			type	"rectangle"
			fill	"#FFFFFFE6"
			fill2	"#D4D4D4CC"
			outline	"#123EA2"
			topBorderInset	40.034505208333314
			bottomBorderInset	1.701171875
			leftBorderInset	8.328125
			rightBorderInset	0.0
		]
		LabelGraphics
		[
			text	"Legend"
			fontSize	14
			fontStyle	"bold"
			fontName	"Dialog"
			model	"null"
		]
		isGroup	1
	]
	node
	[
		id	8
		label	"Control
State"
		graphics
		[
			x	592.5
			y	295.5
			w	47.0
			h	46.0
			type	"roundrectangle"
			raisedBorder	0
			fill	"#FFCC00"
			outline	"#000000"
		]
		LabelGraphics
		[
			text	"Control
State"
			fontSize	12
			fontStyle	"bold"
			fontName	"Dialog"
			model	"null"
		]
		gid	7
	]
	node
	[
		id	9
		label	"Control
State"
		graphics
		[
			x	789.5
			y	295.5
			w	47.0
			h	46.0
			type	"roundrectangle"
			raisedBorder	0
			fill	"#FFCC00"
			outline	"#000000"
		]
		LabelGraphics
		[
			text	"Control
State"
			fontSize	12
			fontStyle	"bold"
			fontName	"Dialog"
			model	"null"
		]
		gid	7
	]
	edge
	[
		source	1
		target	2
		label	"error flow"
	]
	edge
	[
		source	3
		target	4
		label	"core flow"
	]
	edge
	[
		source	5
		target	6
		label	"non-core flow"
	]
	edge
	[
		source	8
		target	9
		label	"event [ guard ]
/ output"
	]
	edge
	[
		source	8
		target	9
		label	"transition"
	]
]
