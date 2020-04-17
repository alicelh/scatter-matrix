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
    padding = 20,
    x = d3.scaleLinear(),
    y = d3.scaleLinear(),
    histScale = [],
    domainByTrait = {},
    line = d3.line()
    .curve(d3.curveBasis),
    color = '#aaaaaa',
    axis_color = '#eeeeee',
    brushCell,
    svg;

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
      columns = d3.keys(data[0]);
      size = (width - (columns.length + 1) * padding) / columns.length + padding;
      x.range([padding / 2, size - padding / 2]);
      y.range([size - padding / 2, padding / 2]);
      // Get Min and Max of each of the columns
      columns.forEach(function (column) {
        domainByTrait[column] = d3.extent(data, function (d) {
          return +d[column];
        });
        histScale[column] = d3.scaleLinear().range([size - padding / 2, padding / 2]);
      });

      var formatSiPrefix = d3.format("3,.1s");

      // Draw Axis
      var xAxis = d3.axisBottom()
        .ticks(5)
        .scale(x)
        .tickFormat(formatSiPrefix);

      var yAxis = d3.axisLeft()
        .ticks(5)
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
        .text(d => d);
    })
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
        x.domain(domainByTrait[p.x]);
        y.domain(domainByTrait[p.y]);
        brushCell = this;
      }
    }

    // Highlight the selected circles.
    function brushmove(p) {
      if (d3.event.selection === null) return;
      var [
        [x0, y0],
        [x1, y1]
      ] = d3.event.selection;
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
      selectedHistaogram(p, x0, x1, y0, y1);
    }

    // If the brush is empty, select all circles.
    function brushend() {
      if (d3.event.selection !== null) return;
      svg.selectAll(".selected").classed("selected", false);
      selectedHistaogram();
    }
  }

  // ----------------------------------------------------------------
  // add new hitogram for selected data when brushing on scatter plot
  // ----------------------------------------------------------------
  function selectedHistaogram(label, x0, x1, y0, y1) {
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

      var histData = data.filter(function (d) {
        if (x0 <= d[label.x] && x1 >= d[label.x] && y1 <= d[label.y] &&
          y0 >= d[label.y]) {
          return true;
        } else {
          return false;
        }
      });

      histData = histData.map(function (d) {
        return +d[p.x];
      });

      // having scatters in brush area
      if (histData.length > 0) {
        var thresholds = x.ticks(20);

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
            return "translate(" + x(findNearestSmall(d.x0)) + "," + histScale[p.x](d.length / data.length) + ")";
          }).append("rect")
          .attr("x", 1)
          .attr("width", d => x(thresholds[1]) - x(thresholds[0]))
          .attr("height", function (d) {
            return size - padding / 2 - histScale[p.x](d.length / data.length);
          })
          .style("fill", function (d) {
            return 'blue';
          });
      }

      function findNearestSmall(d) {
        for (let i = 0; i < thresholds.length; i++) {
          if (thresholds[i] >= d) {
            if (i === 0) return thresholds[0];
            return thresholds[i - 1];
          }
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
  function plot(p) {
    var cell = d3.select(this);

    x.domain(domainByTrait[p.x]);
    y.domain(domainByTrait[p.y]);

    cell.append("rect")
      .style("fill", "none")
      .style("stroke", "#555")
      .attr("x", padding / 2)
      .attr("y", padding / 2)
      .attr("width", size - padding)
      .attr("height", size - padding);

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
        return color;
      });

    cell.call(brush);
  }

  // ----------------------------------------------------
  // draw histogram plot
  // ----------------------------------------------------
  function plotHistogram(p) {
    var cell = d3.select(this).attr('class', 'histogramCell');

    x.domain(domainByTrait[p.x]);
    y.domain(domainByTrait[p.y]);

    cell.append("rect")
      .style("fill", "none")
      .style("stroke", "#555")
      .attr("x", padding / 2)
      .attr("y", padding / 2)
      .attr("width", size - padding)
      .attr("height", size - padding);

    // Extract data for histogramming into single array
    var histData = data.map(function (d) {
      return +d[p.x];
    });

    var thresholds = x.ticks(20);

    // Generate a histogram using twenty uniformly-spaced bins.
    hist = d3.histogram()
      .thresholds(thresholds)
      (histData);


    histScale[p.x].domain([0, d3.max(hist, function (d) {
      return d.length / data.length;
    })]);

    var bar = cell.selectAll(".bar")
      .data(hist)
      .enter().append("g")
      .attr("class", "bar")
      .classed("histogram", true)
      .attr("transform", function (d) {
        return "translate(" + x(d.x0) + "," + histScale[p.x](d.length / data.length) + ")";
      });

    bar.append("rect")
      .attr("x", 1)
      .attr("width", d => x(d.x1) - x(d.x0))
      .attr("height", function (d) {
        return size - padding / 2 - histScale[p.x](d.length / data.length);
      })
      .style("fill", function (d) {
        return color;
      });

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