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
    domainByTrait = {},
    line = d3.line()
    .curve(d3.curveBasis),
    color = '#aaaaaa',
    axis_color = '#eeeeee';

  //Create function to export
  function chart(selection) {
    selection.each(function () {
      // Create svg
      var svg = d3.select(this).append('svg')
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
      .style("fill", function (d) {
        return color;
      });
  }

  function plotHistogram(p) {
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

    // Extract data for histogramming into single array
    var histData = data.map(function (d) {
      return +d[p.x];
    });

    var thresholds = x.ticks(20);

    // Generate a histogram using twenty uniformly-spaced bins.
    var hist = d3.histogram()
      .thresholds(thresholds)
      (histData);

    var histScale = d3.scaleLinear()
      .domain([0, d3.max(hist, function (d) {
        return d.length / data.length;
      })])
      .range([size - padding / 2, padding / 2]);

    var bar = cell.selectAll(".bar")
      .data(hist)
      .enter().append("g")
      .attr("class", "bar")
      .classed("histogram", true)
      .attr("transform", function (d) {
        return "translate(" + x(d.x0) + "," + histScale(d.length / data.length) + ")";
      });

    bar.append("rect")
      .attr("x", 1)
      .attr("width", d => x(d.x1) - x(d.x0))
      .attr("height", function (d) {
        return size - padding / 2 - histScale(d.length / data.length);
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