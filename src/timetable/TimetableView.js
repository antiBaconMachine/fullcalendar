
setDefaults({
	allDaySlot: true,
	allDayText: 'all-day',
	firstHour: 6,
	slotMinutes: 30,
	defaultEventMinutes: 120,
	axisFormat: 'h(:mm)tt',
	timeFormat: {
		timetable: 'h:mm{ - h:mm}'
	},
	dragOpacity: {
		timetable: .5
	},
	minTime: 0,
	maxTime: 24
});


// TODO: make it work in quirks mode (event corners, all-day height)
// TODO: test liquid width, especially in IE6


function TimetableView(element, calendar, viewName) {
	var t = this;
	
	
	// exports
	t.renderAgenda = renderAgenda;
	t.setWidth = setWidth;
	t.setHeight = setHeight;
	t.beforeHide = beforeHide;
	t.afterShow = afterShow;
	t.defaultEventEnd = defaultEventEnd;
	t.timePosition = timePosition;
	t.dayOfWeekCol = dayOfWeekCol;
	t.dateCell = dateCell;
	t.cellDate = cellDate;
	t.cellIsAllDay = cellIsAllDay;
	t.allDayRow = getAllDayRow;
	t.allDayBounds = allDayBounds;
	t.getHoverListener = function() {return hoverListener};
	t.colContentLeft = colContentLeft;
	t.colContentRight = colContentRight;
	t.getDaySegmentContainer = function() {return daySegmentContainer};
	t.getSlotSegmentContainer = function() {return slotSegmentContainer};
	t.getMinMinute = function() {return minMinute};
	t.getMaxMinute = function() {return maxMinute};
	t.getBodyContent = function() {return slotContent}; // !!??
	t.getRowCnt = function() {return 1};
	t.getColCnt = function() {return colCnt};
	t.getColWidth = function() {return colWidth};
	t.getSlotHeight = getPixelHeight;
	t.defaultSelectionEnd = defaultSelectionEnd;
	t.renderDayOverlay = renderDayOverlay;
	t.renderSelection = renderSelection;
	t.clearSelection = clearSelection;
	t.reportDayClick = reportDayClick; // selection mousedown hack
	t.dragStart = dragStart;
	t.dragStop = dragStop;
	t.getSlotData = getSlotData;
	window.getSlotData = getSlotData;
	t.getSlotForPosition = function(y){
		return coordinateGrid.getSlotForPosition(y);
	};
	
	
	// imports
	View.call(t, element, calendar, viewName);
	OverlayManager.call(t);
	SelectionManager.call(t);
	TimetableEventRenderer.call(t);
	var opt = t.opt;
	var trigger = t.trigger;
	var clearEvents = t.clearEvents;
	var renderOverlay = t.renderOverlay;
	var clearOverlays = t.clearOverlays;
	var reportSelection = t.reportSelection;
	var unselect = t.unselect;
	var daySelectionMousedown = t.daySelectionMousedown;
	var slotSegHtml = t.slotSegHtml;
	var formatDate = calendar.formatDate;
	
	
	// locals
	
	var dayTable;
	var dayHead;
	var dayHeadCells;
	var dayBody;
	var dayBodyCells;
	var dayBodyCellInners;
	var dayBodyFirstCell;
	var dayBodyFirstCellStretcher;
	var slotLayer;
	var daySegmentContainer;
	var allDayTable;
	var allDayRow;
	var slotScroller;
	var slotContent;
	var slotSegmentContainer;
	var slotTable;
	var slotTableFirstInner;
	var axisFirstCells;
	var gutterCells;
	var selectionHelper;
	
	var viewWidth;
	var viewHeight;
	var axisWidth;
	var colWidth;
	var gutterWidth;
	var slotHeight; // TODO: what if slotHeight changes? (see issue 650)
	var savedScrollTop;
	
	var colCnt;
	var slotCnt;
	var coordinateGrid;
	var hoverListener;
	var colContentPositions;
	var slotTopCache = {};
	
	var tm;
	var firstDay;
	var nwe;            // no weekends (int)
	var rtl, dis, dit;  // day index sign / translate
	var minMinute, maxMinute;
	var colFormat;
	
	var slotPattern = opt('slotPattern');

	/* Rendering
	-----------------------------------------------------------------------------*/
	
	
	disableTextSelection(element.addClass('fc-timetable'));
	
	
	function renderAgenda(c) {
		colCnt = c;
		updateOptions();
		if (!dayTable) {
			buildSkeleton();
		}else{
			clearEvents();
		}
		updateCells();
	}
	
	
	
	function updateOptions() {
		tm = opt('theme') ? 'ui' : 'fc';
		nwe = opt('weekends') ? 0 : 1;
		firstDay = opt('firstDay');
		if (rtl = opt('isRTL')) {
			dis = -1;
			dit = colCnt - 1;
		}else{
			dis = 1;
			dit = 0;
		}
		minMinute = parseTime(opt('minTime'));
		maxMinute = parseTime(opt('maxTime'));
		colFormat = opt('columnFormat');
	}
	
	
	
	function buildSkeleton() {
		var headerClass = tm + "-widget-header";
		var contentClass = tm + "-widget-content";
		var s;
		var i;
		var d;
		var maxd;
		var minutes;
		var slotNormal = slotPattern != null ? false :  opt('slotMinutes') % 15 == 0;
		
		s =
			"<table style='width:100%' class='fc-timetable-days fc-border-separate' cellspacing='0'>" +
			"<thead>" +
			"<tr>" +
			"<th class='fc-timetable-axis " + headerClass + "'>&nbsp;</th>";
		for (i=0; i<colCnt; i++) {
			s +=
				"<th class='fc- fc-col" + i + ' ' + headerClass + "'/>"; // fc- needed for setDayID
		}
		s +=
			"<th class='fc-timetable-gutter " + headerClass + "'>&nbsp;</th>" +
			"</tr>" +
			"</thead>" +
			"<tbody>" +
			"<tr>" +
			"<th class='fc-timetable-axis " + headerClass + "'>&nbsp;</th>";
		for (i=0; i<colCnt; i++) {
			s +=
				"<td class='fc- fc-col" + i + ' ' + contentClass + "'>" + // fc- needed for setDayID
				"<div>" +
				"<div class='fc-day-content'>" +
				"<div style='position:relative'>&nbsp;</div>" +
				"</div>" +
				"</div>" +
				"</td>";
		}
		s +=
			"<td class='fc-timetable-gutter " + contentClass + "'>&nbsp;</td>" +
			"</tr>" +
			"</tbody>" +
			"</table>";
		dayTable = $(s).appendTo(element);
		dayHead = dayTable.find('thead');
		dayHeadCells = dayHead.find('th').slice(1, -1);
		dayBody = dayTable.find('tbody');
		dayBodyCells = dayBody.find('td').slice(0, -1);
		dayBodyCellInners = dayBodyCells.find('div.fc-day-content div');
		dayBodyFirstCell = dayBodyCells.eq(0);
		dayBodyFirstCellStretcher = dayBodyFirstCell.find('> div');
		
		markFirstLast(dayHead.add(dayHead.find('tr')));
		markFirstLast(dayBody.add(dayBody.find('tr')));
		
		axisFirstCells = dayHead.find('th:first');
		gutterCells = dayTable.find('.fc-timetable-gutter');
		
		slotLayer =
			$("<div style='position:absolute;z-index:2;left:0;width:100%'/>")
				.appendTo(element);
				
		if (opt('allDaySlot')) {
		
			daySegmentContainer =
				$("<div style='position:absolute;z-index:8;top:0;left:0'/>")
					.appendTo(slotLayer);
		
			s =
				"<table style='width:100%' class='fc-timetable-allday' cellspacing='0'>" +
				"<tr>" +
				"<th class='" + headerClass + " fc-timetable-axis'>" + opt('allDayText') + "</th>" +
				"<td>" +
				"<div class='fc-day-content'><div style='position:relative'/></div>" +
				"</td>" +
				"<th class='" + headerClass + " fc-timetable-gutter'>&nbsp;</th>" +
				"</tr>" +
				"</table>";
			allDayTable = $(s).appendTo(slotLayer);
			allDayRow = allDayTable.find('tr');
			
			dayBind(allDayRow.find('td'));
			
			axisFirstCells = axisFirstCells.add(allDayTable.find('th:first'));
			gutterCells = gutterCells.add(allDayTable.find('th.fc-timetable-gutter'));
			
			slotLayer.append(
				"<div class='fc-timetable-divider " + headerClass + "'>" +
				"<div class='fc-timetable-divider-inner'/>" +
				"</div>"
			);
			
		}else{
		
			daySegmentContainer = $([]); // in jQuery 1.4, we can just do $()
		
		}
		
		slotScroller =
			$("<div class='slotScroller' style='position:absolute;width:100%;overflow-x:hidden;overflow-y:auto'/>")
				.appendTo(slotLayer);
				
		slotContent =
			$("<div class='scrollInner' style='position:relative;width:100%;'/>")
				.appendTo(slotScroller);
				
		slotSegmentContainer =
			$("<div style='position:absolute;z-index:8;top:0;left:0'/>")
				.appendTo(slotContent);
		
		/*This table has been converted to use jQuery builder code mainly so we 
		 *can take advantage of jQuery data()
		 */
		s =
			$("<table class='fc-timetable-slots' style='width:100%' cellspacing='0'>") 
			 .append($("<tbody>"))
			 .children().first();
			 
		d = zeroDate();
		maxd = addMinutes(cloneDate(d), maxMinute);
		addMinutes(d, minMinute);
		var totalMinutes = getTotalMinutes(cloneDate(d), maxd);
		slotCnt = 0;
		for (i=0; d < maxd; i++) {
			var slotData = getSlotData(i,
				{
					start : d.getTime(),
					slotNo : i
				});
			var slotLabel = slotData.title || ((!slotNormal || !minutes) ? formatDate(d, opt('axisFormat')) : '&nbsp;');
			minutes = d.getMinutes();
			s.append(
				$("<tr>")
				.addClass('fc-slot' + i)
				.addClass(!minutes ? '' : 'fc-minor')
				.attr("height", getPercentageHeight(slotData.length, totalMinutes))
				.append(
					$("<th>")
					.addClass("fc-timetable-axis")
					.addClass(headerClass)
					.html(slotCnt + ": " + formatDate(d, opt('axisFormat')) + " " + slotLabel)	
					)
				.append(
					$("<td>")
					.addClass(contentClass)
					.data("slotData", slotData)
					.append(
						$("<div>")
						.html("&nbsp;")
						.addClass("contentDiv")
						)));
			addMinutes(d, slotData.length);
			slotCnt++;
		}
		s = s.parent();
		slotTable = $(s).appendTo(slotContent);
		slotTableFirstInner = slotTable.find('div:first');
		
		slotBind(slotTable.find('td'));
		
		axisFirstCells = axisFirstCells.add(slotTable.find('th:first'));
	}
	
	function getSlotData(i, extra) {
		var ret = opt('slotMinutes');
		if (slotPattern) {
			ret = slotPattern[i] || ret;
		}
		return wrapSlotData(ret, slotPattern, i, extra);
	}
	
	function getPixelHeight(i) {
		if (typeof i === "undefined") {
			return slotHeight;
		} 
		return $("#calendar .fc-slot"+i).height();
	}
	
	/*Slot patterns can be passed as simple int lengths or complex objects. If
	 *the pattern is not long enough it is padded with default length slots.
	 *We wrap all possibilities into objects here for consistency
	 */
	function wrapSlotData(d, slotPattern, i, extra) {
		if (typeof d !== "object") {
			d = {
				length : d,
				title : null
			}
		}
		if (extra) {
			$.extend(d, extra);
		}
		if (slotPattern && typeof i !== "undefined") {
			slotPattern[i] = d;
		}
		return d;
	}
	
	function getPercentageHeight(slotLength, totalMinutes) {
		if (opt('varriableSlotHeights')) {
			return slotLength / totalMinutes * 100 + "%";
		}
		return "auto";
	}
	
	function getTotalMinutes(begin, end) {
		return parseInt((end.getTime() - begin.getTime()) / (1000 * 60));
	}
	
	//count slots between start and end time
	function getSlotCount(begin, end) {
		var start = cloneDate(begin);
		var count = 0;
		var defaultSlot = opt('slotMinutes');
		if (slotPattern.length) {
			for (var i in slotPattern) {
				var slotData = wrapSlotData(slotPattern[i]);
				addMinutes(start, slotData.length);
				count++;
				if (start >= end) {
					break;
				}
			}
		}
		while (start < end) {
			addMinutes(start, defaultSlot);
			count++;
		}
		return count;
	}
	
	function updateCells() {
		var i;
		var headCell;
		var bodyCell;
		var date;
		var today = clearTime(new Date());
		for (i=0; i<colCnt; i++) {
			date = colDate(i);
			headCell = dayHeadCells.eq(i);
			headCell.html(formatDate(date, colFormat));
			bodyCell = dayBodyCells.eq(i);
			if (+date == +today) {
				bodyCell.addClass(tm + '-state-highlight fc-today');
			}else{
				bodyCell.removeClass(tm + '-state-highlight fc-today');
			}
			setDayID(headCell.add(bodyCell), date);
		}
	}
	
	
	
	function setHeight(height, dateChanged) {
		var fixedHeight = height !== undefined;
		if (height === undefined) {
			height = viewHeight;
		}
		viewHeight = height;
		slotTopCache = {};
	
		var headHeight = dayBody.position().top;
		var allDayHeight = slotScroller.position().top; // including divider
		var bodyHeight = height - headHeight;
		if (!fixedHeight) {
			bodyHeight = Math.min( // total body height, including borders
			bodyHeight,   // when scrollbars
			slotTable.height() + allDayHeight + 1 // when no scrollbars. +1 for bottom border
		)
		}
		
		dayBodyFirstCellStretcher
			.height(bodyHeight - vsides(dayBodyFirstCell));
		
		slotLayer.css('top', headHeight);
		
		var ssh = bodyHeight - allDayHeight - 1
		slotScroller.height(ssh);
		
		slotHeight = slotTableFirstInner.height() + 1; // +1 for border
		
		if (dateChanged) {
			resetScroll();
		}
	}
	
	function setWidth(width) {
		viewWidth = width;
		colContentPositions.clear();
		
		axisWidth = 0;
		setOuterWidth(
			axisFirstCells
				.width('')
				.each(function(i, _cell) {
					axisWidth = Math.max(axisWidth, $(_cell).outerWidth());
				}),
			axisWidth
		);
		
		var slotTableWidth = slotScroller[0].clientWidth; // needs to be done after axisWidth (for IE7)
		//slotTable.width(slotTableWidth);
		
		gutterWidth = slotScroller.width() - slotTableWidth;
		if (gutterWidth) {
			setOuterWidth(gutterCells, gutterWidth);
			gutterCells
				.show()
				.prev()
				.removeClass('fc-last');
		}else{
			gutterCells
				.hide()
				.prev()
				.addClass('fc-last');
		}
		
		colWidth = Math.floor((slotTableWidth - axisWidth) / colCnt);
		setOuterWidth(dayHeadCells.slice(0, -1), colWidth);
	}
	


	function resetScroll() {
		var d0 = zeroDate();
		var scrollDate = cloneDate(d0);
		scrollDate.setHours(opt('firstHour'));
		var top = timePosition(d0, scrollDate) + 1; // +1 for the border
		function scroll() {
			slotScroller.scrollTop(top);
		}
		scroll();
		setTimeout(scroll, 0); // overrides any previous scroll state made by the browser
	}
	
	
	function beforeHide() {
		savedScrollTop = slotScroller.scrollTop();
	}
	
	
	function afterShow() {
		slotScroller.scrollTop(savedScrollTop);
	}
	
	
	
	/* Slot/Day clicking and binding
	-----------------------------------------------------------------------*/
	

	function dayBind(cells) {
		cells.click(slotClick)
			.mousedown(daySelectionMousedown);
	}


	function slotBind(cells) {
		cells.click(slotClick)
			.mousedown(slotSelectionMousedown);
	}
	
	
	function slotClick(ev) {
		if (!opt('selectable')) { // if selectable, SelectionManager will worry about dayClick
			var col = Math.min(colCnt-1, Math.floor((ev.pageX - dayTable.offset().left - axisWidth) / colWidth));
			var date = colDate(col);
			var rowMatch = this.parentNode.className.match(/fc-slot(\d+)/); // TODO: maybe use data
			if (rowMatch) {
				var mins = parseInt(rowMatch[1]) * opt('slotMinutes');
				var hours = Math.floor(mins/60);
				date.setHours(hours);
				date.setMinutes(mins%60 + minMinute);
				trigger('dayClick', dayBodyCells[col], date, false, ev);
			}else{
				trigger('dayClick', dayBodyCells[col], date, true, ev);
			}
		}
	}
	
	
	
	/* Semi-transparent Overlay Helpers
	-----------------------------------------------------*/
	

	function renderDayOverlay(startDate, endDate, refreshCoordinateGrid) { // endDate is exclusive
		if (refreshCoordinateGrid) {
			coordinateGrid.build();
		}
		var visStart = cloneDate(t.visStart);
		var startCol, endCol;
		if (rtl) {
			startCol = dayDiff(endDate, visStart)*dis+dit+1;
			endCol = dayDiff(startDate, visStart)*dis+dit+1;
		}else{
			startCol = dayDiff(startDate, visStart);
			endCol = dayDiff(endDate, visStart);
		}
		startCol = Math.max(0, startCol);
		endCol = Math.min(colCnt, endCol);
		if (startCol < endCol) {
			dayBind(
				renderCellOverlay(0, startCol, 0, endCol-1)
			);
		}
	}
	
	
	function renderCellOverlay(row0, col0, row1, col1) { // only for all-day?
		var rect = coordinateGrid.rect(row0, col0, row1, col1, slotLayer);
		return renderOverlay(rect, slotLayer);
	}
	

	function renderSlotOverlay(overlayStart, overlayEnd) {
		var dayStart = cloneDate(t.visStart);
		var dayEnd = addDays(cloneDate(dayStart), 1);
		for (var i=0; i<colCnt; i++) {
			var stretchStart = new Date(Math.max(dayStart, overlayStart));
			var stretchEnd = new Date(Math.min(dayEnd, overlayEnd));
			if (stretchStart < stretchEnd) {
				var col = i*dis+dit;
				var rect = coordinateGrid.rect(0, col, 0, col, slotContent); // only use it for horizontal coords
				var top = timePosition(dayStart, stretchStart);
				var bottom = timePosition(dayStart, stretchEnd);
				rect.top = top;
				rect.height = bottom - top;
				slotBind(
					renderOverlay(rect, slotContent)
				);
			}
			addDays(dayStart, 1);
			addDays(dayEnd, 1);
		}
	}
	
	
	
	/* Coordinate Utilities
	-----------------------------------------------------------------------------*/
	
	
	coordinateGrid = new CoordinateGrid(function(rows, cols) {
		var e, n, p;
		dayHeadCells.each(function(i, _e) {
			e = $(_e);
			n = e.offset().left;
			if (i) {
				p[1] = n;
			}
			p = [n];
			cols[i] = p;
		});
		p[1] = n + e.outerWidth();
		if (opt('allDaySlot')) {
			e = allDayRow;
			n = e.offset().top;
			rows[0] = [n, n+e.outerHeight()];
		}
		var slotTableTop = 0;
		var slotScrollerTop = 0;
		var slotScrollerBottom = slotScrollerTop + slotContent.outerHeight();
		function constrain(n) {
			return Math.max(slotScrollerTop, Math.min(slotScrollerBottom, n));
		}
		
		var currentTop = slotTableTop;
		for (var i=0; i<slotCnt; i++) {
			var nextTop = currentTop + getPixelHeight(i);
			var row = [
				constrain(currentTop),
				constrain(nextTop)
			];
			rows.push(row);
			currentTop = nextTop;
		}
		
		//Hack an extra function in to do reverse lookups based on a position
		coordinateGrid.getSlotForPosition = function(y) {
			y-=slotTableTop;
		  var slot = null;
			var len = rows.length;
			var row;
			var allDay = opt('allDaySlot');
			for (	var i =  allDay ? 1 : 0; i<len; i++) {
				row = rows[i];
				if (y >= row[0] && y < row[1] ) {
					slot = i;
					break;
				}
			}
			if (slot) {
				slot = allDay ? slot-1 : slot;
				return $.extend(getSlotData(slot), {
					slotNo : slot,
					row : row
				});
			} else {
				return slot;
			}
		}
	});
	
	
	hoverListener = new HoverListener(coordinateGrid);
	
	
	colContentPositions = new HorizontalPositionCache(function(col) {
		return dayBodyCellInners.eq(col);
	});
	
	
	function colContentLeft(col) {
		return colContentPositions.left(col);
	}
	
	
	function colContentRight(col) {
		return colContentPositions.right(col);
	}
	
	
	
	
	function dateCell(date) { // "cell" terminology is now confusing
		return {
			row: Math.floor(dayDiff(date, t.visStart) / 7),
			col: dayOfWeekCol(date.getDay())
		};
	}
	
	
	function cellDate(cell) {
		var d = colDate(cell.col);
		var slotIndex = cell.row;
		if (opt('allDaySlot')) {
			slotIndex--;
		}
		if (slotIndex >= 0) {
			addMinutes(d, minMinute + slotIndex * opt('slotMinutes'));
		}
		return d;
	}
	
	
	function colDate(col) { // returns dates with 00:00:00
		return addDays(cloneDate(t.visStart), col*dis+dit);
	}
	
	
	function cellIsAllDay(cell) {
		return opt('allDaySlot') && !cell.row;
	}
	
	
	function dayOfWeekCol(dayOfWeek) {
		return ((dayOfWeek - Math.max(firstDay, nwe) + colCnt) % colCnt)*dis+dit;
	}
	
	
	
	
	// get the Y coordinate of the given time on the given day (both Date objects)
	function timePosition(day, time) { // both date objects. day holds 00:00 of current day
		day = cloneDate(day, true);
		if (time < addMinutes(cloneDate(day), minMinute)) {
			return 0;
		}
		if (time >= addMinutes(cloneDate(day), maxMinute)) {
			return slotTable.height();
		}
		var start = cloneDate(time);
		start.setHours(0);
		start.setMinutes(0);
		start.setSeconds(0);
		start.setMilliseconds(0);
		addMinutes(start, minMinute);
		var slotMinutes = opt('slotMinutes'),
		minutes = time.getHours()*60 + time.getMinutes() - minMinute,
		slotI = getSlotCount(start,time),
		cached = slotTopCache[slotI];
		
		//TODO: is this extended cache actually useful? right now it's not
		if (cached === undefined) {
			var row = slotTable.find('tr:eq(' + slotI + ')');
			var div = row.find("td div");
			cached = slotTopCache[slotI] = {
				row : row,
				div : div,
				slotTop : div.position().top
			};
		}
		
		return Math.max(0, Math.round(
			cached.slotTop
		));
	}
	
	
	function allDayBounds() {
		return {
			left: axisWidth,
			right: viewWidth - gutterWidth
		}
	}
	
	
	function getAllDayRow(index) {
		return allDayRow;
	}
	
	
	function defaultEventEnd(event) {
		var start = cloneDate(event.start);
		if (event.allDay) {
			return start;
		}
		return addMinutes(start, opt('defaultEventMinutes'));
	}
	
	
	
	/* Selection
	---------------------------------------------------------------------------------*/
	
	
	function defaultSelectionEnd(startDate, allDay) {
		if (allDay) {
			return cloneDate(startDate);
		}
		return addMinutes(cloneDate(startDate), opt('slotMinutes'));
	}
	
	
	function renderSelection(startDate, endDate, allDay) { // only for all-day
		if (allDay) {
			if (opt('allDaySlot')) {
				renderDayOverlay(startDate, addDays(cloneDate(endDate), 1), true);
			}
		}else{
			renderSlotSelection(startDate, endDate);
		}
	}
	
	
	function renderSlotSelection(startDate, endDate) {
		var helperOption = opt('selectHelper');
		coordinateGrid.build();
		if (helperOption) {
			var col = dayDiff(startDate, t.visStart) * dis + dit;
			if (col >= 0 && col < colCnt) { // only works when times are on same day
				var rect = coordinateGrid.rect(0, col, 0, col, slotContent); // only for horizontal coords
				var top = timePosition(startDate, startDate);
				var bottom = timePosition(startDate, endDate);
				if (bottom > top) { // protect against selections that are entirely before or after visible range
					rect.top = top;
					rect.height = bottom - top;
					rect.left += 2;
					rect.width -= 5;
					if ($.isFunction(helperOption)) {
						var helperRes = helperOption(startDate, endDate);
						if (helperRes) {
							rect.position = 'absolute';
							rect.zIndex = 8;
							selectionHelper = $(helperRes)
								.css(rect)
								.appendTo(slotContent);
						}
					}else{
						rect.isStart = true; // conside rect a "seg" now
						rect.isEnd = true;   //
						selectionHelper = $(slotSegHtml(
							{
								title: '',
								start: startDate,
								end: endDate,
								className: ['fc-select-helper'],
								editable: false
							},
							rect
						));
						selectionHelper.css('opacity', opt('dragOpacity'));
					}
					if (selectionHelper) {
						slotBind(selectionHelper);
						slotContent.append(selectionHelper);
						setOuterWidth(selectionHelper, rect.width, true); // needs to be after appended
						setOuterHeight(selectionHelper, rect.height, true);
					}
				}
			}
		}else{
			renderSlotOverlay(startDate, endDate);
		}
	}
	
	
	function clearSelection() {
		clearOverlays();
		if (selectionHelper) {
			selectionHelper.remove();
			selectionHelper = null;
		}
	}
	
	
	function slotSelectionMousedown(ev) {
		if (ev.which == 1 && opt('selectable')) { // ev.which==1 means left mouse button
			unselect(ev);
			var dates;
			hoverListener.start(function(cell, origCell) {
				clearSelection();
				if (cell && cell.col == origCell.col && !cellIsAllDay(cell)) {
					var d1 = cellDate(origCell);
					var d2 = cellDate(cell);
					dates = [
						d1,
						addMinutes(cloneDate(d1), opt('slotMinutes')),
						d2,
						addMinutes(cloneDate(d2), opt('slotMinutes'))
					].sort(cmp);
					renderSlotSelection(dates[0], dates[3]);
				}else{
					dates = null;
				}
			}, ev);
			$(document).one('mouseup', function(ev) {
				hoverListener.stop();
				if (dates) {
					if (+dates[0] == +dates[1]) {
						reportDayClick(dates[0], false, ev);
					}
					reportSelection(dates[0], dates[3], false, ev);
				}
			});
		}
	}
	
	
	function reportDayClick(date, allDay, ev) {
		trigger('dayClick', dayBodyCells[dayOfWeekCol(date.getDay())], date, allDay, ev);
	}
	
	
	
	/* External Dragging
	--------------------------------------------------------------------------------*/
	
	
	function dragStart(_dragElement, ev, ui) {
		hoverListener.start(function(cell) {
			clearOverlays();
			if (cell) {
				if (cellIsAllDay(cell)) {
					renderCellOverlay(cell.row, cell.col, cell.row, cell.col);
				}else{
					var d1 = cellDate(cell);
					var d2 = addMinutes(cloneDate(d1), opt('defaultEventMinutes'));
					renderSlotOverlay(d1, d2);
				}
			}
		}, ev);
	}
	
	
	function dragStop(_dragElement, ev, ui) {
		var cell = hoverListener.stop();
		clearOverlays();
		if (cell) {
			trigger('drop', _dragElement, cellDate(cell), cellIsAllDay(cell), ev, ui);
		}
	}


}
