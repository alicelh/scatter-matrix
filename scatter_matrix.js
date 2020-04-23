function scatterMatrix() {
  var data = [],
    width, height, margin = {
      top: 10,
      right: 10,
      bottom: 10,
      left: 50
    },
    columns = [],
    size = 0,
    padding = 25,
    // x = d3.scaleLinear(),
    x = d3.scaleSqrt(),
    y = d3.scaleSqrt(),
    histScale = [],
    domainByTrait = {},
    line = d3.line()
    .curve(d3.curveBasis),
    binCount = 20,
    color = '#aaaaaa',
    axis_color = '#eeeeee',
    selectedColor = '#ff7f00',
    brushCell,
    svg,
    xAxis = d3.axisBottom(),
    yAxis = d3.axisLeft(),
    formatSiPrefix = function (d) {
      if (d < 1000) return d;
      else return d3.format(".1s")(d);
    }
  labels = {
    'amount': '价格',
    'buyers': '买家',
    'quantity': '数量'
  };

  //Create function to export
  function chart(selection) {
    selection.each(function () {
      // Create svg
      svg = d3.select(this).append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      // Init setting value
      columns = Object.keys(labels);
      size = (width - (columns.length + 1) * padding) / columns.length + padding;
      x.range([padding / 2, size - padding / 2]);
      y.range([size - padding / 2, padding / 2]);
      // Get Min and Max of each of the columns
      columns.forEach(function (column) {
        domainByTrait[column] = d3.extent(data, function (d) {
          return +d[column];
        });
        domainByTrait[column][1] = Math.pow(findNearestSqrt(domainByTrait[column][1]), 2);
        histScale[column] = d3.scaleLinear().range([size - padding / 2, padding / 2]);
      });

      var cell = svg.selectAll(".cell")
        .data(cross(columns, columns))
        .enter().append("g")
        .attr("class", "cell")
        .attr("transform", function (d) {
          return "translate(" + d.i * size + "," + d.j * size + ")";
        })

      cell.filter(function (d) {
        return d.i > d.j;
      }).each(plot);
      cell.filter(function (d) {
        return d.i === d.j;
      }).each(plotHistogram);

      // Draw Label
      svg.append("g")
        .style("font", "bold 10px sans-serif")
        .selectAll("text")
        .data(columns)
        .join("text")
        .attr("transform", (d, i) => `translate(${(i+1) * size-padding},${i * size})`)
        .attr("x", 0)
        .attr("y", padding)
        .attr('text-anchor', 'end')
        .attr("dy", ".71em")
        .text(d => labels[d]);
    })
  }

  // ----------------------------------------------------
  // Draw axis only one for each column and row
  // ----------------------------------------------------
  function drawAxis() {
    // Draw Axis
    xAxis.ticks(5)
      .scale(x)
      .tickFormat(formatSiPrefix);

    yAxis.ticks(5)
      .scale(y)
      .tickFormat(formatSiPrefix);

    // Create each x-axis
    svg.selectAll(".x.axis")
      .data(columns)
      .enter().append("g")
      .attr("class", "x axis")
      .attr("transform", function (d, i) {
        return "translate(" + i * size + "," + ((i + 1) * size - padding / 4) + ")";
      })
      .each(function (d, i) {
        x.domain(domainByTrait[d]);
        xAxis.tickSize(-size * (i + 1) + padding / 4);
        d3.select(this).call(xAxis)
          .call(g => g.select(".domain").remove())
          .call(g => g.selectAll(".tick line").attr("stroke", axis_color));
      });

    // Create each y-axis
    svg.selectAll(".y.axis")
      .data(columns)
      .enter().append("g")
      .attr("class", "y axis")
      .attr("transform", function (d, i) {
        return "translate(" + (i * size + padding / 4) + "," + i * size + ")";
      })
      .each(function (d, i) {
        y.domain(domainByTrait[d]);
        yAxis.tickSize(-size * (columns.length - i) + padding / 4);
        d3.select(this).call(yAxis)
          .call(g => g.select(".domain").remove())
          .call(g => g.selectAll(".tick line").attr("stroke", axis_color));
      });
  }

  // ----------------------------------------------------
  // brush on histogram chart and highlight the selected data
  // ----------------------------------------------------
  function brushOnHistogram(cell) {
    var brush = d3.brushX()
      .extent([
        [padding / 2, padding / 2],
        [size - padding / 2, size - padding / 2]
      ])
      .on("start", brushstart)
      .on("brush", brushmove)
      .on("end", brushend);

    cell.call(brush);
    var thresholds;
    var x0, x1;

    function brushstart(p) {
      if (brushCell !== this) {
        var tickValues = getAxisTicks(domainByTrait[p.x][1]);
        thresholds = tickValues.slice(0, tickValues.length - 1);
        // remove the last brush on other cell
        d3.select(brushCell).call(brush.move, null);
        brushCell = this;
      }
    }

    // Highlight the selected circles.
    function brushmove(p) {
      if (!d3.event.sourceEvent) return;
      if (d3.event.selection === null) return;
      svg.selectAll(".selected").classed("selected", false);
      selectedHistogram();
      x.domain(domainByTrait[p.x]);
      [
        x0, x1
      ] = d3.brushSelection(brushCell);
      x0 = x.invert(x0);
      x1 = x.invert(x1);
      x0 = findNearest(x0, 0, p.x);
      x1 = findNearest(x1, 1, p.x);
      if (x1 === domainByTrait[p.x][1]) {
        svg.selectAll("circle.data").classed("selected", d => {
          return x0 <= d[p.x] &&
            x1 >= d[p.x]
        });
      } else {
        svg.selectAll("circle.data").classed("selected", d => {
          return x0 <= d[p.x] &&
            x1 > d[p.x]
        });
      }
      selectedHistogram(p, x0, x1, x1, x0);
    }

    // return the histogram bar start value according to the argument
    function findNearest(d, isabove, label) {
      for (let i = 0; i < thresholds.length; i++) {
        if (thresholds[i] === d) {
          return thresholds[i];
        }
        if (thresholds[i] > d) {
          if (isabove) return thresholds[i];
          else return thresholds[i - 1];
        }
      }
      if (isabove) return domainByTrait[label][1];
      else return thresholds[thresholds.length - 1];
    }

    // If the brush is empty, select all circles.
    function brushend(p) {
      if (!d3.event.sourceEvent) return;
      if (!d3.event.selection) {
        svg.selectAll(".selected").classed("selected", false);
        selectedHistogram();
        return;
      }
      x.domain(domainByTrait[p.x]);
      d3.select(this).transition().call(brush.move, [x(x0), x(x1)]);
    }
  }

  // ----------------------------------------------------
  // brush on scatter plot and highlight the selected data
  // ----------------------------------------------------
  function brush(cell) {
    var brush = d3.brush()
      .extent([
        [padding / 2, padding / 2],
        [size - padding / 2, size - padding / 2]
      ])
      .on("start", brushstart)
      .on("brush", brushmove)
      .on("end", brushend);

    cell.call(brush);

    // Clear the previously-active brush, if any.
    function brushstart(p) {
      if (brushCell !== this) {
        d3.select(brushCell).call(brush.move, null);
        brushCell = this;
      }
    }

    // Highlight the selected circles.
    function brushmove(p) {
      if (d3.event.selection === null) return;
      x.domain(domainByTrait[p.x]);
      y.domain(domainByTrait[p.y]);
      var [
        [x0, y0],
        [x1, y1]
      ] = d3.brushSelection(brushCell);
      x0 = x.invert(x0);
      x1 = x.invert(x1);
      y0 = y.invert(y0);
      y1 = y.invert(y1);
      svg.selectAll("circle.data").classed("selected", d => {
        return x0 <= d[p.x] &&
          x1 >= d[p.x] &&
          y1 <= d[p.y] &&
          y0 >= d[p.y];
      });
      // update histogram
      selectedHistogram(p, x0, x1, y0, y1);
    }

    // If the brush is empty, select all circles.
    function brushend() {
      if (d3.event.selection !== null) return;
      svg.selectAll(".selected").classed("selected", false);
      selectedHistogram();
    }
  }

  // ----------------------------------------------------------------
  // add new hitogram for selected data when brushing on scatter plot
  // ----------------------------------------------------------------
  function selectedHistogram(label, x0, x1, y0, y1) {
    // remove the new hitogram when brush ends
    if (arguments.length === 0) {
      svg.selectAll('.histogramCell').each(function () {
        var cell = d3.select(this);
        cell.selectAll(".selectedbar").remove();
      })
      return;
    }
    // filter the selected data and update new histogram for selected data
    svg.selectAll('.histogramCell').each(function (p) {
      var cell = d3.select(this);

      x.domain(domainByTrait[p.x]);

      var histData;
      if (x1 === domainByTrait[p.x][1] && y0 === domainByTrait[p.y][1]) {
        histData = data.filter(function (d) {
          if (x0 <= d[label.x] && x1 >= d[label.x] && y1 <= d[label.y] &&
            y0 >= d[label.y]) {
            return true;
          } else {
            return false;
          }
        });
      } else if (y0 === domainByTrait[p.y][1]) {
        histData = data.filter(function (d) {
          if (x0 <= d[label.x] && x1 > d[label.x] && y1 <= d[label.y] &&
            y0 >= d[label.y]) {
            return true;
          } else {
            return false;
          }
        });
      } else if (x1 === domainByTrait[p.x][1]) {
        histData = data.filter(function (d) {
          if (x0 <= d[label.x] && x1 >= d[label.x] && y1 <= d[label.y] &&
            y0 > d[label.y]) {
            return true;
          } else {
            return false;
          }
        });
      } else {
        histData = data.filter(function (d) {
          if (x0 <= d[label.x] && x1 > d[label.x] && y1 <= d[label.y] &&
            y0 > d[label.y]) {
            return true;
          } else {
            return false;
          }
        });
      }

      histData = histData.map(function (d) {
        return +d[p.x];
      });

      // having scatters in brush area
      if (histData.length > 0) {
        // var thresholds = x.ticks(20);
        // var thresholds = d3.range(domainByTrait[p.x][0], domainByTrait[p.x][1], (domainByTrait[p.x][1] - domainByTrait[p.x][0]) / binCount);
        var tickValues = getAxisTicks(domainByTrait[p.x][1]);
        var thresholds = tickValues.slice(0, tickValues.length - 1);

        var hist = d3.histogram()
          .thresholds(thresholds)
          (histData);

        cell.selectAll(".selectedbar").remove();

        var bar = cell.selectAll(".selectedbar")
          .data(hist);

        bar.enter().append("g")
          .attr("class", "selectedbar")
          .classed("histogram", true)
          .attr("transform", function (d) {
            return "translate(" + x(findNearestSmall(d.x0, thresholds)) + "," + histScale[p.x](d.length / data.length) + ")";
          })
          .append("rect")
          .attr("width", d => x(thresholds[1]) - x(thresholds[0]))
          .attr("height", function (d) {
            return size - padding / 2 - histScale[p.x](d.length / data.length);
          })
          .style("fill", function (d) {
            return selectedColor;
          });

        // return the histogram bar start value according to the argument
        function findNearestSmall(d, thresholds) {
          for (let i = 0; i < thresholds.length; i++) {
            if (thresholds[i] === d) return thresholds[i];
            if (thresholds[i] > d) {
              return thresholds[i - 1];
            }
          }
          return thresholds[thresholds.length - 1];
        }
      }
    })
  }


  // for kde line
  function epanechnikov(bandwidth) {
    return x => Math.abs(x /= bandwidth) <= 1 ? 0.75 * (1 - x * x) / bandwidth : 0;
  }

  function kde(kernel, thresholds, data) {
    return thresholds.map(t => [t, d3.mean(data, d => kernel(t - d))]);
  }

  function cross(a, b) {
    var c = [],
      n = a.length,
      m = b.length,
      i, j;
    for (i = -1; ++i < n;)
      for (j = -1; ++j < m;)
        c.push({
          x: a[i],
          i: i,
          y: b[j],
          j: j
        });
    return c;
  }

  // ----------------------------------------------------
  // draw scatter plot
  // ----------------------------------------------------
  function plot(p, i) {
    var cell = d3.select(this);

    x.domain(domainByTrait[p.x]);
    y.domain(domainByTrait[p.y]);


    // Draw axis
    xAxis.tickValues(getAxisTicks(domainByTrait[p.x][1]))
      .scale(x)
      .tickFormat(formatSiPrefix)
      .tickSize(-size + padding);

    yAxis.tickValues(getAxisTicks(domainByTrait[p.y][1]))
      .scale(y)
      .tickFormat(formatSiPrefix)
      .tickSize(-size + padding);

    cell.append("g")
      .attr("class", "x axis")
      .attr("transform", function () {
        return "translate( 0, " + (size - padding / 2) + ")";
      }).call(xAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", axis_color));

    cell.append("g")
      .attr("class", "y axis")
      .attr("transform", function () {
        return "translate( " + (padding / 2) + ",0)";
      }).call(yAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", axis_color));

    // draw rect border
    cell.append("rect")
      .style("fill", "none")
      .style("stroke", "#555")
      .attr("x", padding / 2)
      .attr("y", padding / 2)
      .attr("width", size - padding)
      .attr("height", size - padding);

    // draw circles
    cell.selectAll("circle.data")
      .data(data)
      .enter().append("circle")
      .classed("data", true)
      .attr("cx", function (d) {
        return x(d[p.x]);
      })
      .attr("cy", function (d) {
        return y(d[p.y]);
      })
      .attr("r", 2)
      .attr("fill", function (d) {
        return d.color;
      });

    cell.call(brush);
  }

  // ----------------------------------------------------
  // draw histogram plot
  // ----------------------------------------------------
  function plotHistogram(p) {
    var cell = d3.select(this).attr('class', 'histogramCell');

    x.domain(domainByTrait[p.x]);

    // Extract data for histogramming into single array
    var histData = data.map(function (d) {
      return +d[p.x];
    });

    // var thresholds = x.ticks(20);
    // var thresholds = d3.range(x(domainByTrait[p.x][0]), x(domainByTrait[p.x][1]), (domainByTrait[p.x][1] - domainByTrait[p.x][0]) / binCount)
    // console.log(thresholds);
    var tickValues = getAxisTicks(domainByTrait[p.x][1]);
    var thresholds = tickValues.slice(0, tickValues.length - 1);

    // Generate a histogram using twenty uniformly-spaced bins.
    hist = d3.histogram()
      .thresholds(thresholds)
      (histData);

    histScale[p.x].domain([0, d3.max(hist, function (d) {
      return d.length / data.length;
    })]);


    // Draw axis
    xAxis.tickValues(tickValues)
      .scale(x)
      .tickFormat(formatSiPrefix)
      .tickSize(-size + padding);

    yAxis.tickValues(d3.range(0, histScale[p.x].domain()[1], 0.1))
      .scale(histScale[p.x])
      .tickFormat(d3.format(".0%"))
      .tickSize(-size + padding);

    cell.append("g")
      .attr("class", "x axis")
      .attr("transform", function () {
        return "translate( 0, " + (size - padding / 2) + ")";
      }).call(xAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", axis_color));

    cell.append("g")
      .attr("class", "y axis")
      .attr("transform", function () {
        return "translate( " + (padding / 2) + ",0)";
      }).call(yAxis)
      .call(g => g.select(".domain").remove())
      .call(g => g.selectAll(".tick line").attr("stroke", axis_color));

    cell.append("rect")
      .style("fill", "none")
      .style("stroke", "#555")
      .attr("x", padding / 2)
      .attr("y", padding / 2)
      .attr("width", size - padding)
      .attr("height", size - padding);

    var bar = cell.selectAll(".bar")
      .data(hist)
      .enter().append("g")
      .attr("class", "bar")
      .classed("histogram", true)
      .attr("transform", function (d, i) {
        return "translate(" + x(thresholds[i]) + "," + histScale[p.x](d.length / data.length) + ")";
      });

    bar.append("rect")
      .attr("width", d => x(thresholds[1]) - x(thresholds[0]))
      .attr("height", function (d) {
        return size - padding / 2 - histScale[p.x](d.length / data.length);
      })
      .attr("fill", function (d) {
        return color;
      });

    cell.call(brushOnHistogram);

    // draw KDE line
    // var bandwidth = 5;
    // density = kde(epanechnikov(bandwidth), thresholds, histData);

    // line.x(d => x(d[0]))
    //   .y(d => histScale(d[1]));

    // cell.append("path")
    //   .datum(density)
    //   .classed('kdepath', true)
    //   .attr("fill", "none")
    //   .attr("stroke", "#000")
    //   .attr("stroke-width", 1.5)
    //   .attr("stroke-linejoin", "round")
    //   .attr("d", line);
  }

  function findNearestSqrt(d) {
    let i = 0;
    while (i * i < d) {
      i++;
    }
    if (i > 12) {
      while (i % 8 !== 0) {
        i++;
      }
    }
    return i;
  }

  function getAxisTicks(d) {
    let max = Math.sqrt(d);
    let increment;
    if (max <= 12) increment = 1;
    else increment = max / 8;
    let result = [];
    for (let i = 0; i <= max; i += increment) {
      result.push(i * i);
    }
    return result;
  }

  chart.width = function (_) {
    if (!arguments.length) return width;
    width = _;
    return chart;
  }

  chart.height = function (_) {
    if (!arguments.length) return height;
    height = _;
    return chart;
  }

  chart.margin = function (_) {
    if (!arguments.length) return margin;
    margin = _;
    return chart;
  }

  chart.padding = function (_) {
    if (!arguments.length) return padding;
    padding = _;
    return chart;
  }

  chart.data = function (_) {
    if (!arguments.length) return data;
    data = _;
    return chart;
  };

  return chart;
}