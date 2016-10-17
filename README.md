# Infro

### Basic Demo: 
 * http://cakey.github.com/infro/ - example server request data
 * http://cakey.github.com/infro/countries.html - human development data

Infro is a Javascript library that uses the excellent D3 library to help drill into tabular data sets to find inconsistencies and anomalies.
It provides an interface to filter on both discrete and continuous aspects of the data, while visualising metrics on that data.

Infro allows you to create your own metrics and formatters, and tries to expose as much of the styling as possible through css.

It exposes both a filterable and a table view - the table view allows you to easily sort and search through the data, while the filterable view allows easy filtering and visualisation of the metrics.

It's current dependencies are:
 * D3
 * Mootools
 * Chosen plugin for mootools

The goal is to reduce this to just D3.

Usage is as follows:

Include the dependencies into the html page.

Create a div to contain the visualisation.
```html
<div id="vis"></div>
```

Initialise a visualisation:
```javascript
infro.init(config_object)
```

Where config_object has the following allowed properties.
 * root_div (the id of the div to place the visualisation in)
 * data (is an object with two properties providing information about the data source:
  * type: the format the data is in, options are currently "tsv", "csv", and json (ie any 'helper' GET methods that d3 implements...)
  * url: the url that returns the JSON data that the visualisation will use
 * unit (the human readable name for each row of data)
 * topx (the number of discrete bars to show in the filterable box)
 * more_info_url (a url that the table links to that can provide more detailed information on that particular object - you parameterise this by including any data field by 3 braces, for example, if 'id' was a key in your data then something like moreinfro/?id={{{id}}} could be used. )
 * metrics ( an object mapping metric names to functions that take an array of values, and apply that metric, these metrics are of the type, mean, median, mode, std deviation etc)
 * filterables ( an object mapping the key of each field in your data to a number of properties that describe how the visualisation should interpret that field )
  * human ( A human readable name for that field, for example, for a field byte_out, human might be 'Bytes out' )
  * format ( A function that formats the value in a human readable way - Currently you can reference infro's formatters by using infro.formatters.{data_size|duration}, but feel free to write your own. )
  * type ( "continuous" or "discrete" determines the type of graph used to visualise that field )
  * aggregable ( whether is makes sense for that field to be summed, for example bytes out or duration could be summed, but not timestamp, even though they are both continuous )
  * scale ( The type of scale that the continuous data uses. Exposes d3's scales through infro.scales.{log|linear|time|pow} https://github.com/mbostock/d3/wiki/Quantitative-Scales for more information )

An example initialisation may be:

```javascript
  <div id="visualisation"></div>
   <script>
   
      infro.init({
         root_div: "visualisation",
         data: {
            type: "json",
            url: "/my/route/to/data.json"
         },
         formatters: {},
         unit: "Requests",
         topx: 4,
         more_info_url: "/moreinfo/?id={{{id}}}",
         metrics:{
            "Std Dev": function(x) {
                 var n = x.length;
                 if (n < 1) return NaN;
                 if (n === 1) return 0;
                 var mean = d3.mean(x),
                     i = -1,
                     s = 0;
                 while (++i < n) {
                   var v = x[i] - mean;
                   s += v * v;
                 }
                 return Math.sqrt(s / (n - 1));
               }
         },
         filterables: {
            byte_out:{
               human: "Bytes out",
               format: infro.formatters.data_size,
               type: "continuous",
               aggregable: true,
               scale: infro.scales.log
            },
            byte_in:{
               human: "Bytes in",
               format: infro.formatters.data_size,
               type: "continuous",
               aggregable: true,
               scale: infro.scales.log
            },
            duration:{
               human: "Response Time",
               format: infro.formatters.duration, /* assumes ms base */
               type: "continuous",
               aggregable: true,
               scale: infro.scales.log
            },
            to:{
               human: "Node",
               type: "discrete"
            },
            request:{
               human: "Url Path",
               type: "discrete"
            },
            response_code:{
               human: "Response Code",
               type: "discrete"
            },
            time:{
               human: "Timestamp",
               format: function(time){return d3.time.format("%b %d %H:%M:%S %Y")(new Date(time*1000))},
               type: "continuous",
               scale: infro.scales.time,
            }
         }
      });
   </script>

```

This is early stage software - there are probably many bugs to fix, and even more features that I'd like to implement, and missing documentation. Feel free to create an issue for any of these points.

Additionally there are currently a number of hacks to make it work in ie8 ( a requirement during previosu development ), these will hopefully be cleaned away.

Thanks go to Riverbed Technology, Inc. for permission to open source.
