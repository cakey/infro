var infro = (function () {
   "use strict";
   /* TODO:
      
      slidey buttons?
      pull out search box?
      rethink discrete
      
      comment
      remove section labels?
      remove boundstorage?
      
      alternative types of filtering other than exact match
      
      
      DONEISH:
      slow in ie8 and firefox :(... STILL (now less slow!)
      (meh)bind data changes to function calls
      
      WISHLIST:

      request fields also toggles filterables (so can set default) - (try to guess how best to represent if not defined)
      clustering of urls hierarchically - a contains filter?
      turning a number of values in a row into a time graph (say: UKpop: 1960: 2, 1970: 4, 1980: 8 etc)
      
      */


   /* d3 helpers & util */

   var identity = function (item) { return item; };
   var arrentity = function (item) { return [item]; };

   /* borrowed from underscore */
   var debounce = function (func, wait, immediate) {
      var timeout;
      return function() {
         var context = this, args = arguments;
         var later = function() {
            timeout = null;
            if (!immediate) { func.apply(context, args); }
         };
         if (immediate && !timeout) { func.apply(context, args); }
         clearTimeout(timeout);
         timeout = setTimeout(later, wait);
      };
  };
  
   /* borrowed from underscore */
   var throttle = function (func, wait) {
    var context, args, timeout, throttling, more, result;
    var whenDone = debounce(function(){ more = throttling = false; }, wait);
    return function() {
      context = this; args = arguments;
      var later = function() {
        timeout = null;
        if (more) { func.apply(context, args); }
        whenDone();
      };
      if (!timeout) { timeout = setTimeout(later, wait); }
      if (throttling) {
        more = true;
      } else {
        result = func.apply(context, args);
      }
      whenDone();
      throttling = true;
      return result;
    };
  };
       
   var is_function = function (function_to_check) {
      var get_type = {};
      return function_to_check && get_type.toString.call(function_to_check) === '[object Function]';
   };

   var is_array = function (array_to_check){
      return Object.prototype.toString.call(array_to_check) === "[object Array]";
   };
   
   var data_bind = function(selection, element, class_name, data, datakey, exit){
      /* bind data to the "element.class_name"'s in selection, optional datakey and exit bind - also sets the position to abosulte to allow the positioning code to work*/
      var new_selection = selection.selectAll(element+"."+class_name).data(data, datakey);
         new_selection.enter().append(element).attr("class", class_name);
         new_selection.style("position", "absolute");
         
         if (exit !== false){
            new_selection.exit().remove();
         }
      return new_selection;
   };
   
   var pluck = function(){
      /* returns a function that will pluck the data out of an object, ie pluck("hi", "bye")({hi: {bye: 2}}) -> 2 */
      var keys = Array.prototype.slice.call(arguments);
      return function(item){
         var plucked_item = item;
         for (var i=0; i<keys.length; i++){
            plucked_item = plucked_item[keys[i]];
         }
         return plucked_item;
      };
   };
   
   String.prototype.contains =  function(other_string) {
      return this.indexOf(other_string) !== -1;
   };
   
   ["height", "width"].forEach(function(dim){
         /* returns the height or width value set for the selection, and removes 'px' */
         d3.selection.prototype[dim] = function() {
         try{
            return Number(this.empty()?0:(this[0][0].style.getPropertyValue(dim).slice(0,-2)) );
         } catch(e){
            return 0;
         }
      };
   });
   
   var get = function(object, key, default_value){
      /* python style dict.get */
      if (object && object[key]){
         return object[key];
      } else {
         return default_value;
      }
   }
   
   /* GUI helpers... */

   var get_font_size = function(width, height, type){
      if (type === "title"){
         return d3.max([d3.min([height/6, width/8,24]), 12]);
      } else if (type === "bar_label"){
         return d3.max([d3.min([height/1.6, width/14,11]), 9]);
      } else if (type === "tick"){
         return d3.max([d3.min([width/32, height/8, 13]), 8]);
      } else if (type == "filters"){
         return d3.max([d3.min([height, width/40, 30]),8]);
      }
   };

   var metric_aggreg = function(){
      return selects.aggreg.human(selects.aggreg.current).toLowerCase()+
                      " "+selects.metric.human(selects.metric.current).toLowerCase();
   };
   
   /* data manipulation helpers... */
   
   var split_dataset = function(dataset, key_field){
      var dataset_by_field = {};
      dataset.forEach(function(item){
         var field_value = item[key_field];
         (dataset_by_field[field_value] || (dataset_by_field[field_value] = [])).push(item);
      });
      return dataset_by_field;
   };

   var pull_out_fields = function(dataset, fields){
      /* pulls out the specified fields from each data item, returning the trimmed data items */
      return dataset.map(function(item){
         var new_item = {};
         fields.forEach(function(field){
            if (field === infro_unit){
               new_item[field] = 1;
            }else if (field === more_info_url){
               new_item[field] = construct_more_info_url(item, user_config.more_info_url);
            } else {
               new_item[field] = item[field]; 
            }
         });
         return new_item;
      });
   };
   
   var pull_out_field = function(dataset, field){
      /* pulls out the specified fields from each data item, returning the values */
      return pull_out_fields(dataset, [field]).map(pluck(field))
   };
   
   var cached_distributions = {}; /* we add resetting this to data_filter's on change */
   
   var get_distribution = function(key_field){
      if (key_field in cached_distributions){
         return cached_distributions[key_field];
      }
      var dataset = data_filter.apply();
      var compare_field = data_filter.metric();
      var reduce_function = data_filter.aggregation();
   
      /* split the data set by the key_field, assumes discrete... */
      var dataset_by_field = split_dataset(dataset, key_field);

      /* pull out the compare_field for each data item and then apply the reduce function for each partition on key_field */
      var reduced_dataset_by_field = d3.entries(dataset_by_field).map(function(field_data){
         return {key: field_data.key, value: reduce_function(pull_out_field(field_data.value, compare_field))};
      });

      /* then return the ordered comparison */
      var distribution =  reduced_dataset_by_field.sort(function(a,b){return d3.descending(a.value, b.value)});
      cached_distributions[key_field] = distribution;
      return distribution;
   };
  
   var filter_sort_format_data = function(columns_to_show, units_sort, units_sort_order){
   
      var filtered_data = data_filter.apply();

      var filtered_rows_to_show = pull_out_fields(filtered_data, columns_to_show);
      
      /* sort the data */
      if (units_sort !== null){
         filtered_rows_to_show.sort(function(a, b){
            return units_sort_order(a[units_sort], b[units_sort]);
         });
      }

      /* want to search on the /visible/ content, so we run through the formatters first  */ 
      
      var formatted_rows = filtered_rows_to_show.map(function(row){
         return d3.entries(row).map(function(col){
            if (col.key !== more_info_url){
               return {key:col.key, 
                           formatted_value: data_filter.format(col.key, col.value),
                           value:col.value};
            }else{
               return {key: more_info_url, value:col.value, formatted_value: "more"};
            }
         });
      });
      return formatted_rows;
   };
   
   /* todo: refactor :( */ 
   var create_histogram = function(data_set, metric, no_bins, bin_width, height){

      var raw_metrics = pull_out_field(data_set, metric).map(Number);
      var min, max;
      if (raw_metrics.length !== 0){
         min = d3.min(raw_metrics); /* log(0) is undefined (we take it off when creating the filter)*/
         if (min ===0){
            min = 1;
         }
         max = d3.max(raw_metrics)+1; /* to get the highest value */
      } else {
         return null;
      }
      
      var metric_scale = data_filter.scale(metric);
      
      var histo_scale = (metric_scale===d3.time.scale?d3.scale.linear:metric_scale)()
         .domain([min,max]).range([0,no_bins]);
      
      var format_min, format_max;
      if (metric_scale === d3.time.scale){
         format_min = new Date((min-10)*1000);
         format_max = new Date((max+10)*1000);
      }else{
         format_min = min;
         format_max = max;
      }
      
      var thresholds = d3.range(0,no_bins+1).map(histo_scale.invert);
      var histo_layout = d3.layout.histogram().bins(thresholds);

      /* calc histograms first as we need max frequency for scaling y axis */
      var histogram = histo_layout(raw_metrics);
      var maxfreqy = d3.max(histogram.map(pluck('y')));

      var Y = d3.scale.pow()
         .exponent(.35)
         .domain([0,maxfreqy])
         .range([height,0]);

      var area = d3.svg.area()
         .x(function(d){ return d[0];})
         .y1(function(d){return d[1];})
         .y0(function(d){return height;})
         .interpolate("basis");
         
      var coords = [[0,height]];
         histogram.forEach(function(v,i){
            coords.push([(i*bin_width)+Math.round(bin_width/2), Y(v.y)]);
         });
         
      coords.push([no_bins*bin_width, height]); /* smooth the right edge */
      var path = area(coords);
      var brushscale = histo_scale.copy().domain([min,max]).range([0, bin_width*no_bins]);
      
      var axisscale = metric_scale()
            .domain([format_min,format_max])
            .range([0, bin_width*no_bins]);
      var formatter =  data_filter.formatter(metric);
      var XAxis = d3.svg.axis().scale(axisscale).ticks(8, formatter).tickSubdivide(5).tickSize(2,0);
      
      if (metric_scale !== d3.scale.log && metric_scale !== d3.time.scale){
         XAxis.tickFormat(formatter);
      }
      
      var snap_to_bin = function(extent){
         /* find the current_bin_nos */
         var bin_no_l = histo_scale(extent[0]);
         var bin_no_u = histo_scale(extent[1]);
      
         var rounded_bins_apart = Math.round(bin_no_u - bin_no_l);
         var real_bins_apart = bin_no_u - bin_no_l;
         
         if (Math.abs(rounded_bins_apart - real_bins_apart) < 0.08){
            /* If they are a multiple of bin width apart, them keep them that way */
               var lower = Math.round(bin_no_l);
               return [lower, lower+ rounded_bins_apart].map(histo_scale.invert);
         }else {
            /* otherwise snap to the closest bin (turn metric values to bin_numbers and then back to metric value) */
               return extent.map(histo_scale).map(Math.round).map(histo_scale.invert);
         }
      };
      
      var brush = d3.svg.brush().x(brushscale)
         .on("brush.histo", function(d,i){
            var old_extent = brush.extent();
            var new_extent = snap_to_bin(old_extent);
               d3.select(this.parentNode).select(".brush").call(brush.extent(new_extent));
               if (data_filter.has(metric)){ /* so we don;t immediately move the filter up */
                  if (new_extent[0] === 1){
                     new_extent[0] -=1;
                  }
                  /* if the filter would have changed */
                  if (!data_filter.has(metric, new_extent)){
                     data_filter.add(metric, new_extent);
                  }
               }
         })
         .on("brushend.histo", function(d,i){
            var new_extent = snap_to_bin(d.brush.extent());
            if (new_extent[0] === 1){
               new_extent[0] -=1;
            }
            data_filter.add(metric, new_extent);
         });
         
         if (data_filter.has(metric)){
            var details = data_filter.get(metric);
            brush.extent(snap_to_bin([details[0]+(details[0]===0?1:0), /* cant have 0 lower detail beca use of log scales */
                                          details[1]
                                        ])
                             );
         }
      
      return {formatter: formatter, filterable: metric, axis:XAxis, path:path, thresholds:thresholds, xscale:axisscale, yscale:Y, histogram:histogram, bin_width:bin_width, brush:brush};
   };
                                                  
   var construct_more_info_url = function(unit, template){
      /* returns a string with the appropriate data fields inserted into the template */
      
      for (var key in unit){
         template = template.replace("{{{"+key+"}}}", unit[key], 'g')
      }
      
      return template;
   };
      
      
   /* provided formatters user can specify in config */

   var datasize_formatter = function (value) {
      value = Math.round(value)
      var endings = ["B", "KB", "MB", "GB", "TB", "PB", "EB"],
          base = 1024,
          magnitude;
      for (magnitude=0; magnitude<endings.length; magnitude++){
        if (value < base){
           return value+endings[magnitude];
        }
        value = Math.round(value/base); 
      }
   };

   var duration_formatter = function(value){
      value = Math.round(value)
      var ranges = [["ms", 1000], ["s", 60], ["m", 60], ["hr", 24], ["days", 7], ["weeks", 52]],
         i;
      for (i=0; i < ranges.length; i++){
         var metric = ranges[i][0],
             bound  = ranges[i][1];
         if (value < bound){
            return (Math.round(value * 10) / 10 )+metric;
         }
         value /= bound;
      }
      return null;
    };

   
   /* State changers. */
      
   var FilterHolder = function(data, filterables, metric, aggreg){
      
      var that = this;
      
      var on_change_func;
      
      var _filterables = filterables;
      var _data = data;
      var _filters = {}
      var _metric = metric;
      var _aggreg = aggreg;
      
      this.length = function(){
         return _data.length;
      };
      
      this.set_aggregation = function (aggreg){
         if (_aggreg !== aggreg){
            _aggreg = aggreg;
            change();
         }
      };
      
      this.aggregation = function(){
         return _aggreg;
      };
      
      this.set_metric = function(metric){
         if (_metric !== metric){
            _metric = metric;
            change();
         }
      };
      
      this.metric = function(){
         return _metric;
      };
      
      this.format = function(key, value){
         return that.formatter(key)(value);
      };
      
      this.formatter = function(key){
         return get(_filterables[key], 'format', identity);
      };
      
      this.is_aggregable = function(key){
         return get(_filterables[key], 'aggregable', false);
      };
      
      this.human = function(key){
         return get(_filterables[key], 'human', key);
      };
      
      this.scale = function(key){
         return get(_filterables[key], 'scale', 'null');
      };
      
      this.type = function(key){
         return get(_filterables[key], 'type', 'discrete');
      };
      
      var change = function(){
         /* call the bound callback */
         if (is_function(on_change_func)){
            on_change_func();
         }
      };
      
      this.add = function(key, details){
      
         /* short circuit if nothing to do */
         if (key in _filters && _filters[key].details === details){ return null;}
         
         if (is_array(details) && details[0] === details[1]){
            details[1]+=1;
         }
         
         /* calculate the order of the new filter and add it */
         var insert_order = (key in _filters)?_filters[key].order:d3.entries(_filters).length;
         _filters[key] = {details:details, order:insert_order};
        
         change(); /* callback */
      };
      this.del = function(key){
         /* delete the filter and maintain the ordering */
         var deleted_order = _filters[key].order;
         delete _filters[key];
         for (var filter in _filters){
            if (_filters[filter].order > deleted_order){
               _filters[filter].order -= 1;
            }
         }
         change(); /* callback */
      };
      
      this.on_change = function(func){
         on_change_func = func;
         return this;
      };    
      
      this.apply_upto = function(filter, include_last){
      
         var filters = d3.entries(_filters);
               
         var highest_order = _filters[filter].order;
         var applicable_filters = filters.filter(function(f){
            if (include_last){
               return f.value.order <= highest_order;
            }else{
               return f.value.order < highest_order;
            }
         });
         
         var old_filters = _filters;
         
         /* apply all those filters */
         _filters = {};
         applicable_filters.forEach(function(f){_filters[f.key] = f.value;});
         
         var filtered_dataset = that.apply();
         
         _filters = old_filters;
         
         return filtered_dataset
      }
      this.apply = function(dataset, extra_filters){
         /*
          * dataset expects an array of objects, each object is a data item
          * filters expects an object with keys "discrete, continuous",
          *        each key will then have filters:
          *                discrete: value of filter
          *                continuous : [min,max]
          */

         var filters_to_use = d3.entries(_filters).concat(d3.entries(extra_filters));
         
         return _data.filter(function(item){
            /* each item needs to match all discrete and continuous filters */
            return filters_to_use.every(function(filter){
                  if (that.type(filter.key) === "discrete"){
                     if (filter.value.match === "contains"){
                        return String(item[filter.key]).contains(filter.value.details);
                     }
                     return String(item[filter.key]) === String(filter.value.details); /* javascript doesn't like integer keys... */
                  }else{
                     var item_value = item[filter.key];
                     return ( item_value >= filter.value.details[0] &&
                              item_value <=  filter.value.details[1]);
                  }
            });
         });
      };
      this.match = function(key, detail){
         if (!that.has(key)){return false;}
         
         if (that.type(key) === "discrete"){
            return detail === _filters[key].details;
         } else if (that.type(key) === "continuous"){
            return (detail >= _filters[key].details[0] &&
                       detail <= _filters[key].details[1]);
         }
      }
      this.has = function(key, details){
      
         if (typeof details === "undefined"){
            return key in _filters;
         }
         if (is_array(details)){
            return (key in _filters &&
                        details[0] === _filters[key].details[0] &&
                        details[1] === _filters[key].details[1])
         } else {
            return (key in _filters && details == _filters[key].details);
         }
         
      };
      this.get = function(key){
         if (!that.has(key)){return null;}
         return _filters[key].details
      }
      this.filterables = function(){
         return d3.keys(_filterables).filter(function(key){return that.type(key) === "continuous" || that.type(key) === "discrete";});
      };
      this.filters = function(){
         return d3.keys(_filters);
      };
      this.fields = function(){
         return d3.keys(_data[0]);
      };
      this.metrics = function(){
         return d3.keys(_filterables).filter(function(key){
            return that.type(key) === "continuous" && that.is_aggregable(key);
         });
      };
   };   
   
   
   /* The meat. Renders things in a hierarchical way. infro.js */

   var render_visualisation = throttle(function(){

      /* The sizes */
      cached_rows = null;
      
      var viewport = function(){
         var e = window
         , a = 'inner';
         if ( !( 'innerWidth' in window ) )  {
         a = 'client';
         e = document.documentElement || document.body;
         }
         return { width : e[ a+'Width' ] , height : e[ a+'Height' ] }
      }
      
      var width  = Number(viewport().width)-10;
      var height = Number(viewport().height)-10;
      if (width<100 || height < 100){
         /* if the visualisation isn't visible everything breaks */
         return null;
      }
      
      /* where to put everything */
      var div = d3.select("#"+user_config.root_div)
         .style("width", width+"px")
         .style("position", "absolute");

      var total =  data_filter.filterables().length;
      var num_filters = data_filter.filters().length;

      var tab_height = d3.max([20, d3.min([44, height/20])]);
      var content_height = height - tab_height-30;
      
      var filters_portion = ((num_filters/total)*(1/2));
      var display_portion = 1 - filters_portion;
      var display_height = content_height*display_portion;
      var filters_height = content_height*filters_portion;

      var content_group = data_bind(div, "div", "content", arrentity)
            .style("width", width+"px")
            .style("height", display_height+"px")
            .style("top", (filters_height+tab_height)+30+"px");
      
      var tab_group = data_bind(div, "div", "tab", arrentity)
            .style("width", width+"px")
            .style("height", tab_height+"px")
            .style("top", (filters_height)+30+"px")
            .classed("tab_bar", "true")
            .call(render_tab_bar, /* tab stuff: */ content_group);
            
      /* rendered last for overlapping reasons */
      var filters_group = data_bind(div, "div", "filters", arrentity)
            .style("width", width+"px")
            .style("height", filters_height+"px")
            .style("top", "30px")
            .call(render_filters);
      
      div.call(options.render)
                  /*
      var logo = data_bind(div, "img", "logo", arrentity)
         .attr("src", "images/titlebar_logo.png")
         .style("left", width-150+"px");       */
   }, 300);
   
   var render_options = function(hidden_group, open){

         
         var options = [ {callable:selects.aggreg.render, top: 0},
                                 {callable:selects.metric.render, top: 56},
                                 {callable:selects[display_units].render, top: 112}];
                         
         var labels = [ {text:"Aggregation type:", top: 0},
                                 {text:"Aggregation field:", top: 56},
                                 {text:"Visible fields:", top: 112}];
                             
         data_bind(hidden_group, "div", "option_label", labels)
            .style("left", "50px")
            .style("height", "50px")
            .style("top", function(option){return option.top+10+"px";})
            .text(pluck("text"));
                             
         data_bind(hidden_group, "div", "selects", options)
            .style("left", "50px")
            .style("height", "50px")
            .style("top", function(option){return option.top+12+16+"px";})
            .each(function(option, i){d3.select(this).call(option.callable);});
         
         var sentence  = data_bind(hidden_group, "div", "sentence", arrentity)
            .style("top", hidden_group.height()-25+"px")
            .style("width", hidden_group.width()-20+"px")
            .style("left", 10+"px")
            .style("height", "25px")
            .style("font-size", "14px")
            .html("Ordering by <span class='hl'>" + metric_aggreg() +  
                      "</span> of the " + user_config.unit + " in <span class='hl'>"+selects[display_units].current.length+'</span> fields.');
                      
         var src = open?"up":"down";
         var image = data_bind(hidden_group, "img", "img1", arrentity)
            .style("top", hidden_group.height()-27+"px")
            .style("width", "20px")
            .style("left", hidden_group.width()-45+"px")
            .style("height", "20px")
            .attr("src", "images/button-"+src+".png"); // TODO: use css
            
         var image = data_bind(hidden_group, "img", "img2", arrentity)
            .style("top", 10+"px")
            .style("left", 10+"px")
            .attr("src", "images/icon-config.png"); // TODO: use css
   }

      var col = function(key, i){ /* hacky helper for column position */
         var font_size = 12;
         var columns_to_show = selects[display_units].current.slice();
         if (user_config.more_info_url){
            columns_to_show.unshift(more_info_url);
         }

         var cumu = 0;
         var cumu_lengths = columns_to_show.map(function(col){
            var returnee = cumu;
            cumu += column_lengths[col]+1;
            return returnee;
         });
         
         return {left:(cumu_lengths[i]*(font_size+3)*0.6+10)+10,
                     width:(column_lengths[key]*(font_size+3)*0.6+10),
                     show: columns_to_show,
                     cumu: cumu
                     }
      };
   
   var render_units = function(units_group_wrapper){

      var ug_margin = 20;

      var units_group = data_bind(units_group_wrapper, "div", "display_units_tab", arrentity)
            .style("width", units_group_wrapper.width()-(ug_margin*2)+"px")
            .style("height", units_group_wrapper.height()-(ug_margin*2)+"px")
            .style("left", ug_margin+"px")
            .style("top", ug_margin+"px");
            
      var font_size = 12;
      var row_height = font_size * 1.5;
          
      var vertical_scroll_area = data_bind(units_group, "div", "vscroll", arrentity)
         .style("width", units_group.width()-20+"px")
         .style("height", (units_group.height()-(row_height*3))-20+"px")
         .style("top", (row_height*2.5)+20+"px");
      
      var render_units_scroll = function(){
         vertical_scroll_area.call(render_scroll_area, render_units_data, {horizontal:[headers]}, true);
         data_bind(header_cols, "div", "arrows", arrentity)
               .classed("down_arrow", function(d){
                  return units_sort === d && units_sort_order === d3.descending;
               })
               .classed("up_arrow", function(d){
                  return units_sort === d && units_sort_order === d3.ascending;
               })
               .style("top",  (font_size+10)/4+"px");
      };
      
      var header_wrapper = data_bind(units_group, "div", "twrapper", arrentity)
         .style("top", (row_height*1.5)+20+"px");
            
      var headers = data_bind(header_wrapper, "div", "titles", [col().show])
         .style("height", font_size+10+"px");
                          
      var header_cols = data_bind(headers, "div", "units_title", identity);
      
      header_cols
            .style("left", function(d,i){return col(d, i).left+"px";})
            .style("width", function(d,i){return col(d, i).width+"px";})
            .text(function(key){return key !== more_info_url? data_filter.human(key):"More";})
            .on("click", function(d,i){
               if (d !== more_info_url){
                  units_sort = d;
                  units_sort_order = (units_sort_order===d3.ascending)?d3.descending:d3.ascending;
                  cached_rows = null;
                  render_units_scroll()
               }
            })
            .style("cursor", "pointer")
            .style("font-size", font_size+5+"px");   
            
      render_units_scroll()
   
      /* Create the search box */
      var search_box = data_bind(units_group, "input", "searchy", function(d){return [{default_text: "Search..."}];})
         .attr("placeholder", function(d){return d.default_text;})
         .style("width", 250+"px")
         .style("left", 20+"px")
         .style("top", 15+"px")
         .style("height", (row_height)+"px")
         .on("keyup", function(d,i){
            var text;
            if (d3.event.target){
               text = d3.event.target.value;
            }else{
               text = d3.event.srcElement.value;
            }
            if (text !== d.default_text && text !== ""){
               if (units_search !== text){
                  units_search = text;
                  render_units_scroll()
               }
            } else {
               if (units_search !== null){
                  units_search = null;
                  render_units_scroll()
               }
            }
         });

   };

   var render_units_data = function(group){
      
      var scroll_top = group[0].parentNode.scrollTop;
      var units_width = group.width();

      var font_size = 12;
      var row_height = font_size * 1.5;
     
      /* we cache the rows in a global so that we don't have to recompute everything whenm we are simply scrolling... */
      if (cached_rows === null){
         cached_rows = filter_sort_format_data(col().show, units_sort, units_sort_order);
      }
      var formatted_rows = cached_rows;
      
      /* search the data */
      var searched_rows = units_search===null?formatted_rows:
         formatted_rows.filter(function(row){
            return row.some(function(col){
               return String(col.formatted_value).contains(units_search);
            })
         });
         
      /* Only render visible rows.
          We go through this song and dance of only rendering visible rows, because firefox
          is orders of magnitude slower than chrome/ie at creating dom elements... */
      var space_available = d3.select(group[0].parentNode).height();
      var visible_rows = space_available/row_height;
      var first_row = d3.max([0, Math.floor((scroll_top/row_height)-visible_rows/3)])
      var last_row = d3.min([searched_rows.length, Math.ceil((scroll_top/row_height)+visible_rows*(4/3))])
      
      group.style("height", ((searched_rows.length+2)*row_height)+"px");
      group.style("width", ((col().cumu*(font_size+3)*0.6)-20)+"px");
      
      var rows = data_bind(group, "div", "units_row", searched_rows.slice(first_row,last_row), identity)
            .style("top", function(d,i){ return ((i+first_row)*row_height)+"px";})
            .classed("even", function(d,i){return (i+first_row)%2===0;});
            
      var cols = data_bind(rows, "div", "units_col", identity)
      
            .style("left", function(d,i){return col(d,i).left+"px";})
            .style("width", function(d,i){return col(d.key, i).width+"px";})
            .text(pluck("formatted_value"))
            .on("click", function(d,i){
               if (d.key === more_info_url){
                  window.open(d.value, d.value);
               }else{
                  /* if continuous then make continuous */
                  if (data_filter.type(d.key) === "continuous" ){
                     data_filter.add(d.key, [d.value, d.value]);
                  }else{
                     data_filter.add(d.key, d.value);
                  }
               }
            })
            .style("font-size", font_size+"px")
            .style("user-select", "none")
            .style("cursor", "pointer")
            .classed("searched_col",  function(c){return units_search !== null && String(c.formatted_value).contains(units_search)});
   }

   var render_filters = function(filters_group){
      
      var width_pad = 40;
      var filters_width = filters_group.width()-width_pad;
      var filters_height = filters_group.height();
      
      var filters = data_filter.filters();
      var num_filters = filters.length;
      var padding = 5;
      var filter_height = (filters_height/(num_filters))-padding
      var min_key_chars = d3.max(filters, function(key){return data_filter.human(key).length;});    
      
      var font_size = get_font_size(filters_width/2, filter_height, 'filters');
      
      var filter_rows = data_bind(filters_group, "div", "filter_row", filters, function(key){return key+"visrow";})
         .style("top", function(d,i){return ((i)*(filter_height+padding))+"px";})
         .style("width", filters_width+"px")
         .style("left", (width_pad/2)+"px")
         .style("height", filter_height+"px");
      
      var set_constants = function(selection){
         selection
            .style("font-size", font_size+"px")
            .classed("filter_text", true)
            .style("top", (filter_height - font_size)/2+"px");
      }
      var vis_groups = data_bind(filter_rows, "div", "filter_vis", arrentity)
            .style("left", (filters_width/2)-filter_height+"px")
            .style("width", filters_width/2+"px")
            .classed("discrete", function(key){ return data_filter.type(key) === "discrete";})
            .classed("continuous", function(key){ return data_filter.type(key)=== "continuous";})
            .style("height", filter_height+"px");
            
      filter_rows.selectAll("div.continuous")
         .call(render_continuous_post_filter_groups)
      
      var percentages = data_bind(filter_rows, "div", "filter_percent", arrentity, identity)
            .style("left", "5px")
            .text(function(filter){
               var filtered_dataset = data_filter.apply_upto(filter, true);
               
               /* work out the proportion of data items left */
               var proportion_left = filtered_dataset.length/data_filter.length();
               
               /* return it as a percentage */
               return d3.format(".2%")(proportion_left);
            })
            .call(set_constants)
            .on("mouseover", function(){
               render_hover(d3.event.clientX, d3.event.clientY+20, "The percentage of "+user_config.unit+ " remaining after applying this filter")
            })
            .on("mouseout", function(){
               render_hover("clear");
            });
            
      var titles = data_bind(filter_rows, "div", "filter_title", arrentity, identity)
            .text(data_filter.human)
            .call(set_constants)
            .style("left",(font_size*4.5)+5+"px");
      
      var values = data_bind(filter_rows, "div", "filter_value", arrentity, identity)
            .text(function(key){
               if (data_filter.type(key) == "discrete"){
                  return data_filter.get(key);
               } else {
                  return data_filter.get(key).map(data_filter.formatter(key)).join(" - ");
               }
            })
            .call(set_constants)
            .style("font-size", font_size+"px")//d3.max([font_size-10,6])+"px")
            .style("left", (font_size*(min_key_chars*(3/5)+5))+5+"px");
   
      var delete_button = data_bind(filter_rows, "img", "del_but", arrentity)
         .attr("src", "images/state-error.png") // TODO: use css
         .style("width", filter_height+"px")
         .style("height", filter_height+"px")
         .style("left", filters_width-filter_height+"px")
         .style("cursor", "pointer")
         .on("click", data_filter.del);
         
      var data;
      if (filters.length > 0){
         data = [1]
      }else{
         data = []
      }
      data_bind(filters_group, "div", "section_label", data)
         .style("top", "-34px")
         .style("left", "20px")
         .text("Filtering on...");
   };

   var render_continuous_post_filter_groups = function(selection){
      var no_bins = 40;
      var bin_width = Math.floor(selection.width()/no_bins);
      
      var element_type = svg_support?"svg":"div";
      
      var histogram_groups = data_bind(selection,
                                   element_type, "cont", function(key){
            var filtered_dataset = data_filter.apply_upto(key, false);
            return [create_histogram(filtered_dataset, key, no_bins, bin_width, selection.height())];
         }
      )
         .style("width", selection.width()+"px")
         .style("height", selection.height()+"px")
         .call(render_histo_and_overlay, no_bins, bin_width, true);
   };
      
   var render_filterables = function(filterables_group){
   
      /* config (pull out) */
      var best_aspect_ratio = 15/(user_config.topx); /* how much width per height */
      
      /* a single side, margins collapse */
      var filter_width_padding = 20;
      var filter_height_padding = 20;
      var filter_width_margin = 20;
      var filter_height_margin = 20;
   
      var filterables_width = filterables_group.width();
      var filterables_height = filterables_group.height();
      
      
      /* only leave filterables that don't have values set */
      var filterables = selects[display_units].current.filter(function(key){
         return !data_filter.has(key);
      });
      
      var num_filterables = filterables.length;
      
      if (num_filterables > 0){

         /* work out which number of columns gives us the aspect ratio closest to the best ratio */

         var possible_columns = d3.range(1, Math.ceil(num_filterables/2)+1);
         possible_columns.push(num_filterables);
         var ratios = possible_columns.map(function(columns){
             var rows = Math.ceil(num_filterables/columns)
             var filter_width = (filterables_width-(columns*(filter_width_padding+filter_width_margin)+filter_width_margin))/columns;
             var filter_height = (filterables_height-(rows*(filter_height_padding+filter_height_margin)+filter_height_margin))/rows;
             var actual_aspect_ratio = filter_width/filter_height;
             var compare = actual_aspect_ratio/best_aspect_ratio;
             var normal_compare = compare<1?compare:(1/compare);
             return {columns:columns, compare:normal_compare, rows:rows, width:filter_width, height:filter_height};
         });
         var details = null;
         var best = 0;
         ratios.forEach(function(d){
            if (d.compare>best){
               details = d;
               best = d.compare;
            }
         });

         /* extract the relevant details */

         var columns = details.columns;
         var rows = details.rows;
         
         /* this is space left AFTER margin/padding */
         var filter_width = details.width;
         var filter_height = details.height;
         filterables_group.selectAll("div.section_label").data([]).exit().remove();
      } else {
         var text = "All fields have values selected. Add more fields in the options, or view the "+user_config.units+".";
         data_bind(filterables_group, "div", "section_label", arrentity)
            .style("top", filterables_height/4+"px")
            .style("width", "200px")
            .style("left", filter_width_margin+(filterables_width-(250))/2+"px")
            .style("display", null)
            .style("padding", "25px")
            .text(text);
      }
      
      /* Let's attach a group for each possible filter! */
      
      /* containers */
      var groups = data_bind(filterables_group, "div", "filterable", filterables, function(key){return key+"xfilterable";}, false)
            .style("width", filter_width+filter_width_padding+"px")
            .style("height", filter_height+filter_height_padding+"px")
            .classed("discrete", function(key){ return data_filter.type(key) === "discrete";})
            .classed("continuous", function(key){ return data_filter.type(key) === "continuous";});
         groups.exit().remove();
            
         groups.transition().duration(400)
            .style("left", function(d,i){ return (i%columns)*(filter_width+filter_width_margin+filter_width_padding)+filter_width_margin+"px";})
            .style("top", function(d,i){ return ((filter_height+filter_height_margin+filter_height_padding)*(Math.floor(i/columns)))+filter_height_margin+"px";});
         
      var contents = data_bind(groups, "div", "f_content", arrentity)
            .style("width", filter_width+"px")
            .style("height", filter_height+"px")
            .style("left", filter_width_padding/2+"px")
            .style("top", filter_height_padding/2+"px");
            
      /* helper accessors */
      var discrete_groups = filterables_group.selectAll("div.discrete").selectAll(".f_content")
         .call(render_discrete_pre_filter_groups);
         
      var continuous_groups = filterables_group.selectAll("div.continuous").selectAll(".f_content")
         .call(render_continuous_pre_filter_groups).width();
   };

   var render_tab_bar = function(tab_group, content_group){
      var tab_width = tab_group.width();
      var tab_height = tab_group.height();
      var drop_width = content_group.width();
      var drop_height = content_group.height();
      
      var section_width = d3.max([100,tab_width/7]);
      var padding = 5;

      var tab_set = data_bind(tab_group, "div", "tab", arrentity)
            .style("width", (section_width*2)-padding+"px")
            .style("height", tab_height+"px")
            .style("left", (tab_width-((section_width*2)-padding))/2+"px")
            .style("top", "8px")
            .call(tabs.content.render, content_group, "horizontal");
          
      var content_label = function(){
         var text;
         if (tabs.content.current[0].key === "filterables"){
            text = "Viewing "+metric_aggreg()+" by...";
         }else{
            text = "Viewing "+user_config.unit.toLowerCase()+" details";
         }
      
         data_bind(tab_group, "div", "section_label", arrentity)
            .style("top", "15px")
            .style("left", "20px")
            .text(text);
      };
      
      var refresh_but = data_bind(tab_group, "div", "refresh_but", arrentity)
         .classed("tab_button", true)
         .style("width", section_width-padding-15+"px")
         .style("padding-top", ((tab_height-14)/2)+"px")
         .style("height", tab_height-((tab_height-14)/2)+"px")
         .style("left", tab_width-(section_width)+"px")
         .style("top", "8px")
         .text("Refresh")
         .on("click", function(){window.location.reload()});
      
      content_label();
      tabs.content.on_change(content_label);
         
   };

   var render_group_titles = function(groups){
      var group_width = groups.width();
      var group_height = groups.height();
      var font_size = get_font_size(group_width, group_height, "title");
      
      var bar_titles = data_bind(groups, "div", "title", arrentity)
         .style("top", "-3px")
         .text(data_filter.human)
         .style("font-size", font_size+"px")
         .classed("filterable_title", true);
   };
   
   var render_histo_and_overlay = function(histogram_groups, no_bins, bin_width, post){
            histogram_groups.filter(function(d){return d !== null;})
               .call(render_histogram_groups, post) /* renders the data */
               .call(render_capture_overlays, no_bins, bin_width) /* renders the filter control */
               .on("mouseout", function(d){current_bin = null; current_down_bin = null;
                                           histogram_groups.call(render_capture_overlays, no_bins, bin_width);});
            histogram_groups.filter(function(d){return d === null;}).remove()
   }
   
   var render_continuous_pre_filter_groups = function(continuous_groups){
      var group_width = continuous_groups.width()
      var group_height = continuous_groups.height()
   
      render_group_titles(continuous_groups);
      
      /* filter the data */
      var filtered_data = data_filter.apply();
      
      var no_bins = 40;
      var bin_width = Math.floor((group_width)/no_bins);

      var height = Math.round(group_height-get_font_size(group_width, group_height, "title")/2)*(2/3);
      
      /* create a group for each filter_group, so we can bind the histogram stuff to it
       * to avoid having to recalculate it */
      
      var element_type = svg_support?"svg":"div";
            
      var histogram_groups = data_bind(continuous_groups, element_type, "histo",function(key){
            return [create_histogram(filtered_data, key, no_bins, bin_width, height)];
         })
            .style("width", group_width+"px")
            .style("height", height+20+"px")
            .style("top", (height/3+get_font_size(group_width, group_height, "title"))-20+"px")
            .call(render_histo_and_overlay, no_bins, bin_width, false);
   };
   
   var render_svg_histogram_groups = function(hist_gr, post){
      var tick_size = get_font_size(hist_gr.width(), hist_gr.height(), "tick")
      
      var bar_graphs = data_bind(hist_gr, "g", "bg", arrentity)
         .style("width", hist_gr.width()+"px")
         .style("height", hist_gr.height()+"px");
         
      var cont = data_bind(bar_graphs, "g", "cont", arrentity)
         .style("width", hist_gr.width()+"px")
         .style("height", hist_gr.height()+"px");
      
      var bars = data_bind(cont, "rect", "histo_bar", function(d){
         return d.histogram.map(function(bar){
            return {bar:bar, xscale:d.xscale, yscale:d.yscale, bin_width:d.bin_width};
         });
      })
         .attr("width", function(d){return d.bin_width-2;})
         .attr("height", function(d){return d3.max([0,hist_gr.height()-d.yscale(d.bar.y)])-(post?0:20);;})
         .attr("x", function(d,i){return i*d.bin_width+1;})
         .attr("y", function(d){return d.yscale(d.bar.y)+(post?0:20);});
         
      /* create the axis */
      var axis = data_bind(cont, "g", "axis", function(f){return [f.axis];})
             .attr("transform", function(d,i){
               if (post){
                  return 'translate(0,0)';
               }else{
                  return 'translate(0,0)';
               }
            })
             .each(function(axis){d3.select(this).call(axis);});
          axis.selectAll("text")
            .classed("axis_text", "true")
            .style("font-size",tick_size+"px");
   };

   var render_svg_capture_overlays = function(histogram_groups){
      /* Initialize the brush component with pretty resize handles. */
      
          var gBrush = data_bind(histogram_groups, "g", "brush", arrentity)
            .each(function(d,i){if (d !== null){d3.select(this).call(d.brush);}});
            
          gBrush.selectAll("rect")
            .attr("height", histogram_groups.height());
          
          var paths = data_bind(gBrush.selectAll(".resize"), "path", "brush_handle", arrentity)
            .attr("d", resizePath);
        
      function resizePath(d) {
        var e = +(d == "e"),
            x = e ? 1 : -1,
            y = histogram_groups.height() / 8;
        return "M" + (.5 * x) + "," + y
            + "A6,6 0 0 " + e + " " + (6.5 * x) + "," + (y + 6)
            + "V" + (7 * y - 6)
            + "A6,6 0 0 " + e + " " + (.5 * x) + "," + (7 * y)
            + "Z"
            + "M" + (2.5 * x) + "," + (y + 8)
            + "V" + (7 * y - 8)
            + "M" + (4.5 * x) + "," + (y + 8)
            + "V" + (7 * y - 8);
      }

   };

   var render_div_histogram_groups = function(hist_gr, axis_on_top){ /* css */
   
      var tick_size = get_font_size(hist_gr.width(), hist_gr.height(), "tick")
      
      var bar_graphs = data_bind(hist_gr, "div", "bg", arrentity)
      
      var bars = data_bind(bar_graphs, "div", "histo_bar", function(d){
         return d.histogram.map(function(bar){
            return {bar:bar, xscale:d.xscale, yscale:d.yscale, bin_width:d.bin_width};
         });
      }) 
         .style("width", function(d){return (d.bin_width-2)+"px";})
         .style("height", function(d){return (hist_gr.height()-d.yscale(d.bar.y))+"px";})
         .style("left", function(d,i){return (i*d.bin_width+1)+"px";})
         .style("top", function(d){return ((d.yscale(d.bar.y)))+"px";});
         
         
      /* create the axis */
      var ticks = data_bind(bar_graphs, "div", "tick", function(d){
         var no_ticks = 8;
         if (data_filter.scale(d.filterable) === d3.time.scale){
            var ticks = d.xscale.ticks(no_ticks)
            var formatter = d.xscale.tickFormat(no_ticks);
            return d3.range(ticks.length).map(function(tn){
                  var x = ((tn/(ticks.length-0.5))*d.histogram.length)*d.bin_width;
                  var value = (typeof ticks[tn]=== "undefined")?"":formatter(ticks[tn]);
                  return {x:x, value:value};
               });
         }else{
            return d3.range(no_ticks).map(function(tn){
                  var x = ((tn/no_ticks)*d.histogram.length)*d.bin_width;
                  var value = d.formatter(d.xscale.invert(x));
                  return {x:x, value:value};
               });
        }
      })
         .style("left", function(d,i){
            return d.x+"px";
         })
         .text(pluck("value"))
         .style("font-size", 11+"px");
         
   };

   var render_div_capture_overlays = function(histogram_groups, no_bins, bin_width){
      var height = histogram_groups.height();
   
      /* so we only rerender what is necessary */
      var capture_overlays = data_bind(histogram_groups, "div", "capture",
         function(group){
            return d3.range(no_bins).map(function(bin_no){
               return { bin_no:bin_no, 
                        filterable:group.filterable, 
                        thresholds:[group.thresholds[bin_no],group.thresholds[bin_no+1]]
               };
            })
         })
            .style("left",function(d){return bin_width*d.bin_no+"px"})
            .style("width", bin_width+1+"px") /* shrug */
            .style("height", height+"px")
            .style("cursor", "pointer")
            .style("display", "block")
            .classed("hover", function(bin){
               /* if we are on the right histogram  */
               if (current_bin !== null && bin.filterable === current_bin.filterable){
                  /* if not selecting, then highlight current bin */
                  if (current_down_bin === null){
                     return (current_bin.bin_no === bin.bin_no);
                     
                  /* if selecting, highlight all bins in the right range */
                  } else if (current_down_bin.filterable === bin.filterable){
                     var lower_bin_no = d3.min([current_bin.bin_no, current_down_bin.bin_no]);
                     var upper_bin_no= d3.max([current_bin.bin_no, current_down_bin.bin_no]);
                     return  (bin.bin_no >= lower_bin_no && bin.bin_no <=upper_bin_no);
                  }
               }
            
            })
            .classed("selected", function(bin){
               /* if we have chosen a range for that filter, highlight it */
               return (data_filter.match(bin.filterable, bin.thresholds[0]) &&
                        data_filter.match(bin.filterable, bin.thresholds[1]));
            })
           .on("mouseover", function(bin){current_bin = bin; histogram_groups.call(render_capture_overlays, no_bins, bin_width); }) /*slow down in ie?*/
            .on("click", function(bin){
               if(current_down_bin === null){
                  /* start selection */
                  current_down_bin = bin;
               }else if (current_down_bin.filterable === bin.filterable){
                  /* end selection
                   * take the lowest threshold and the highest thresholds */
                  
                  var thresholds = [current_down_bin.thresholds[0],
                                    current_down_bin.thresholds[1],
                                    bin.thresholds[0],
                                    bin.thresholds[1]];

                  var lowest = Math.floor(d3.min(thresholds))-1;
                  var highest = Math.ceil(d3.max(thresholds));
                 
                  /* reset the current highlight */
                  current_down_bin = null;
                  current_bin = null;
                  /* add the filter */
                  data_filter.add(bin.filterable, [lowest, highest]);

               }
            })
            /* stop the highlight resetting when moving off any bin... */
            .on("mouseout", function(bin){current_bin = null;
               if (!d3.event.stopPropagation){
                  window.event.cancelBubble = true;
               }else{
                  d3.event.stopPropagation();
               }
            });
   };

  
   var render_bar_graph_groups = function(scroll_group){

      var height_available = d3.select(scroll_group[0].parentNode).height();
      var padding = 0.35;
      var bar_height = d3.max([(height_available*0.9)/user_config.topx, 20]);
      var bar_rect_height = bar_height*(1-padding);
      var bar_rect_width = scroll_group.width()*0.9
      
      var bar_groups = data_bind(scroll_group, "div", "bar", function(key, i){
         var distribution = get_distribution(key)
         var total = d3.sum(distribution, pluck("value"));
         
         var scroll_top = scroll_group[i].parentNode.scrollTop;
         var visible_bars = height_available/bar_height;
         var first_bar = d3.max([0, Math.floor((scroll_top/bar_height)-visible_bars/3)])
         var last_bar = d3.min([distribution.length, Math.ceil((scroll_top/bar_height)+visible_bars*(4/3))])
         
         return distribution.slice(first_bar, last_bar).map(function(percentpair){
            return {type:     "discrete", 
                        details:    percentpair.key, 
                        value:      percentpair.value, 
                        total:      total, 
                        max:     distribution[0].value,
                        filterable:key, 
                        current:data_filter.has(key, percentpair.key),
                        offset: first_bar*bar_height };
         }).filter(function(stuff){
            return !filterables_search[key] || stuff.details.toLowerCase().contains(filterables_search[key].toLowerCase());
         });
      }, function(key){return [key, data_filter.get(key)];})
         .style("top", function(d,i){
            return ((bar_height*i)+d.offset)+"px";
         })
         .style("width", bar_rect_width+"px")
         .style("height", bar_rect_height+"px");

      scroll_group.style("height", function(filter, i){
         var filtered_data = data_filter.apply();
         var distribution = get_distribution(filter);
         var returnee =  Math.round(Number(bar_height*(distribution.length-1)+bar_rect_height))+"px";
         return returnee;
      });
      
      var font_size = get_font_size(bar_groups.width(), bar_groups.height(), "bar_label");
      var percents = data_bind(bar_groups, "div", "percent", arrentity)
         .text(function(percentpair){
            /* choose whether to show a percentage or a metric */
            if (data_filter.aggregation() === d3.sum){
               return d3.format(".2%")(percentpair.value/percentpair.total);
            } else {
               if (data_filter.metric() === infro_unit){
                  return percentpair.value;
               }
               return data_filter.format(data_filter.metric(), Math.round(percentpair.value));
            }
         })
         .style("top", (((bar_rect_height-font_size)/2)-1)+"px")
         .style("font-size", font_size+"px");
         
      var bars = data_bind(bar_groups, "div", "bar", arrentity)
         .style("left", "50px")
         .style("width", bar_groups.width()-50+"px")
         .style("height", bar_groups.height()+"px")
         .call(render_bar_groups);
   };

   var render_discrete_pre_filter_groups = function(discrete_groups){

      var title_size = get_font_size(discrete_groups.width(), discrete_groups.height(), "title")
      
      /* The titles */
      discrete_groups.call(render_group_titles);

      filterables_search = {}; /* reset the searches */
      
      /* Create the search box */
      var width = d3.min([275,discrete_groups.width()*(1/2)]);
      var search_box = data_bind(discrete_groups, "input", "searchy", function(key){return [{default_text:"Search...", key:key}];})
         .attr("placeholder", function(d){return d.default_text;})
         .style("width", width+"px")
         .style("top", "-5px")
         .style("height", title_size-5+"px")
         .style("font-size", title_size-8+"px")
         .style("left", (discrete_groups.width()-width)+"px")
         .on("keyup", function(d,i){
            var text;
            if (d3.event.target){
               text = d3.event.target.value
            }else{
               text = d3.event.srcElement.value
            }
            if (text !== d.default_text && text !== ""){
               filterables_search[d.key] = text;
            } else {
               delete filterables_search[d.key];
            }

            d3.select(this.parentNode).selectAll(".scrolly").call(render_scroll_area, render_bar_graph_groups, false, true);
         });

      /* And the bar graphs. */
      var scroll_group = data_bind(discrete_groups, "div", "scrolly", arrentity)
         .style("width", discrete_groups.width()+"px")
         .style("height", discrete_groups.height()-title_size+5+"px")
         .style("top", title_size+"px")
         .call(render_scroll_area, render_bar_graph_groups, false, true);
      
   };

   var render_bar_groups = function(bar_groups){
      var width = bar_groups.width();
      var height = bar_groups.height();
      var font_size = get_font_size(width, height, "bar_label");
      var get_width = function(percentpair){return (((data_filter.aggregation()===d3.sum)?
                                                               (percentpair.value/percentpair.total):
                                                               (percentpair.value/percentpair.max))*width);
                                                };
                                                
      /* The bars. */
      var bar_rects = data_bind(bar_groups, "div", "discrete_bar", arrentity)
            .style("width", function(d){return get_width(d)+"px"})
            .style("height", height-(((height-font_size)/2)-1)+"px")
            .style("padding-top", ((height-font_size)/2)-1+"px")
            .style("cursor", "pointer")
            .style("font-size", font_size+"px")
            .style("padding-left", (height/4)+"px")
            .classed("current", pluck("current"))
            .text(pluck("details"))
            .on("click", function(d){data_filter.add(d.filterable, d.details);});

   };

   /* widgets */
     
   var render_scroll_area = function(scroll_area, render_content_func, bound_elements, refresh){
      
      var hori_pad = 25;
      var vert_pad = 25;
      
      if (bound_elements && 'horizontal' in bound_elements){
         bound_elements['horizontal'].forEach(function(e){
            e .style("width", (scroll_area.width()-hori_pad)+"px")
               .style("overflow", "hidden")
         });
      }
      
      if (bound_elements && 'vertical' in bound_elements){
         bound_elements['vertical'].forEach(function(e){
            e .style("height", (scroll_area.height()-vert_pad)+"px")
               .style("overflow", "hidden")
         });
      }
            
      var content_group = data_bind(scroll_area, "div", "content", arrentity)
         .style("width", (scroll_area.width()-hori_pad)+"px")
         .style("height", (scroll_area.height()-vert_pad)+"px")
         .call(render_content_func, 0);
         
      /* bind other elements so that they scroll with the scroll_area */
      scroll_area
         .on("scroll", function(d, i){
            var that = this;
            if (bound_elements && 'horizontal' in bound_elements){
               bound_elements['horizontal'].forEach(function(e){
                  if (d3.event.target){
                     e[0][0].scrollLeft = d3.event.target.scrollLeft; /* TODO this will probably break if you try to bind multiple bound elements or multiple scroll areas... */
                  }else{
                     e[0][0].scrollLeft = d3.event.srcElement.scrollLeft; /* TODO this will probably break if you try to bind multiple bound elements or multiple scroll areas... */
                  }
               });
            }
            if (bound_elements && 'vertical' in bound_elements){
               bound_elements['vertical'].forEach(function(e){
                  if (d3.event.target){
                     e[0][0].scrollTop = d3.event.target.scrollTop; /* TODO this will probably break if you try to bind multiple bound elements or multiple scroll areas... */
                  }else{
                     e[0][0].scrollTop = d3.event.srcElement.scrollTop; /* TODO this will probably break if you try to bind multiple bound elements or multiple scroll areas... */
                  }
               });
            }
            if (refresh){
               throttle(function(){
                     d3.select(that).selectAll(".content").call(render_content_func);
               },100)()
            }
         })
         .style("overflow", "auto");
         
   };   

   var OptionsHidden = function(content_func){
   
      var that = this;
      var open = false;
   
      this.render = function(div){
         var hidden_group = div.selectAll("div.options").data(arrentity);
             hidden_group  
               .enter()
               .append("div")
               .classed("options", true)
               .style("position", "fixed")
               .style("height", "350px");
               
               
         var top = (open?0:(-(hidden_group.height()-30)));
         hidden_group.transition().duration(400)
               .style("top", top+"px");
          hidden_group
            .style("width", "500px")
            .style("left", ((Number(div.width())-500)/2)+"px")
            .on("click", function(d,i){
               open = !open;
               that.render(div);
            })
            .exit().remove();
         hidden_group.call(content_func, open);
      }
   };
   
   var TabSet = function(options, default_option_key){
      var that = this;
      this.options = options;
      this.current = {};
      
      var get_option_from_key = function(key){
         return that.options.filter(function(obj){return obj.key === key;})[0];
      };
      
      var default_option = get_option_from_key(default_option_key);
      
      this.set = function(option_key){
         var option = get_option_from_key(option_key);
         for (var num in that.current){
            that.current[num] = option;
         }
      };
      
      var on_change_func;
      this.on_change = function(func){
         on_change_func = func;
      }
      var change = function(){
         if (is_function(on_change_func)){
            on_change_func();
         }
      };
      
      
      this.render = function(tab_button_area, content_group, orientation){
      
         var tab_button_width = (orientation === "horizontal")?tab_button_area.width()/that.options.length:tab_button_area.width();
         var tab_button_height = (orientation === "vertical")?tab_button_area.height()/that.options.length:tab_button_area.height();
      
         var tab_buttons = data_bind(tab_button_area, "div", "tab_button", function(group,i){
               if (!that.current[i]){
                  that.current[i] = default_option;
               }
               return that.options.map(function(tab){
                  return {tab:tab, i:i};
               });
            });
         render_actual_tabs(content_group, that);
          
         tab_buttons
            .style("width", tab_button_width+"px")
            .style("top", function(tab, i){return (orientation === "vertical"?(i*(tab_button_height)):0)+"px";})
            .style("left", function(tab, i){return (orientation === "horizontal"?(i*(tab_button_width)):0)+"px";})
            .style("cursor", "pointer")
            .text(pluck("tab", "value", "human"))
            .style("padding-top", ((tab_button_height-14)/2)+"px")
            .style("height", tab_button_height-((tab_button_height-14)/2)+"px")
            .on("click", function(tab){
               that.current[tab.i] = tab.tab;
               that.render(tab_button_area, content_group, orientation);
               change();
            })
            .classed("selected", function(tab){
               return that.current[tab.i].key === tab.tab.key;
            });
      }
   };
   
   var Select = function(options, default_option, hover_text, human){
      /* stores state for the select box, and prettifies it with chosen */
      /* if default_option is an array then use a multi select */
      var that = this;
      var id = String(Math.floor(Math.random()*10000));
      var on_change_func;
      var multi = is_array(default_option);
      
      this.current = default_option;
      
      this.human = function(key){
            return options.filter(function(option){return option.key === key;})[0].value.human;
      }
      
      this.on_change = function(func){
         on_change_func = func;
         return this;
      }
         
      var change = function(){
         if (on_change_func){
            on_change_func(that.current);
         }
      }
         
      this.render = function(group){
      
        var select_group = data_bind(group, "select", "chzn-select", [options])
            .attr("id", id)
            .style("position", null)
            .style("width", "400px");
            
         if (multi){
            select_group.attr("multiple", true);
         }
         
         data_bind(select_group, "option", "option", identity)
            .style("position", null)
            .attr("key", pluck("key"))
            .text(pluck("value", "human"))
            .each(function(d,i){
               var d_o = multi?that.current:[that.current];
               if ( d_o.some(function(key){return d.key === key;}) ) {
                  d3.select(this).attr("selected", true);
               }
            });
         
         $$("#"+id).addEvent("change", function(){
            var values = $(id).getSelected().get("value");
            var keys = options.filter(function(o){return values.some(function(v){return v === o.value.human;});}).map(pluck("key"));
            
            if (multi){
               that.current = keys;
            }else{
               that.current = keys[0];
            }
            change()
         });
         
         $$("#"+id).chosen();

         var stop_prop = function(){
            if (!d3.event.stopPropagation){
               window.event.cancelBubble = true; /* ie */
            }else{
               d3.event.stopPropagation();
            }
         };
         
         /* stops clicks on the selects from closing the options menu */
         group.selectAll('.chzn-container').on('click', stop_prop)
            .selectAll('.chzn-drop').on('click', stop_prop)
            .selectAll('.chzn-results').on('click', stop_prop)
            .selectAll('.option').on('click', stop_prop);
      }
   };
   
   var render_actual_tabs = function(content_group, tabset){

      var create_a_a_tabs = function(tab, renderer){
         var tabs_group = data_bind(tab, "div", "tabby", function(d,i){return [d.d];})
            .style("width", tab.width()+"px")
            .style("height", tab.height()+"px")
            //.style("overflow", "hidden")
            .call(renderer);
      }
      /* for each tab option, make a decision on how and if to render it for each group */
      tabset.options.forEach(function(tab, j){
         var tab_group = data_bind(content_group,"div",tab.key, function(d,i){return [{d:d, i:i}];})
            
            .style("width", content_group.width()+"px")
            .style("height", content_group.height()+"px")
            .each(function(d){
               /*   display the selected tab */
                  if (tabset.current[d.i].key  === tab.key){
                     d3.select(this).call(create_a_a_tabs, tab.value.content)
                                            .style("display", "block");
                     
                  }
            });
            tab_group.transition().duration(500)
               .style("left", function(d){
                  /* determine which option number is current */
                  /* slide the tab to the right position */
                  var cur_o;
                  tabset.options.forEach(function(_tab, k){if (_tab.key === tabset.current[d.i].key){cur_o=k;}});
                  
                  return (j-cur_o)*content_group.width()+"px";
                  }
               );
            tab_group.transition().delay(500)
            .style("display", function(d){
               return ((tabset.current[d.i].key  === tab.key)?"block":"none");
            });
      });
   };
   
   var render_hover = throttle(function(x, y, text){
      var data;
      if (x === "clear"){
         data = [];
      }else{
         data = [text]
      }
      data_bind(d3.select("#"+user_config.root_div), "div", "hover_text", data)
         .style("position", "fixed")
         .style("left", x+"px")
         .style("top", y+"px")
         .text(text)
         .on('click', function(){render_hover("clear");});
   }, 50);

   /* 'GLOBALS' */
      var user_config; /* global place to store config */

      /* if this is passed as the key of a discrete field,
       * then each data item will have the value of 1 */
      var infro_unit = "infro_unit";
      
      var display_units = "display_units";
      var data_filter;
      var filterables_search = {}; /* the current temporary filter imposed by search in the individual filterables boxes */
      var units_search = null; /* the current temporary filter imposed by search in the units tab */
      var units_sort = null;
      var units_sort_order = d3.ascending;
      var current_down_bin = null; /* when selecting a range on a continuous graph, the first bin selected is here */
      var current_bin = null; /* when selecting a range on a continuous graph, the currently hovered bin selected is here */
      var more_info_url = "more_info_url";
      var column_lengths = {more_info_url:4}; /* the max size of each formatted column */
      var selects;
      var tabs;
      var cached_rows = null;
      var options = new OptionsHidden(render_options);
      
      /* switch between svg and divs depending on browser */
      var svg_support = !!document.createElementNS && !!document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect;
      var render_histogram_groups = svg_support?render_svg_histogram_groups:render_div_histogram_groups;
      var render_capture_overlays = svg_support?render_svg_capture_overlays:render_div_capture_overlays;
      
   /* Start here */
   var init_visualisation = function(config){
      user_config = config;

      d3.json(
         user_config.data_url,
         function(data){
            d3.select(window).on("resize",render_visualisation);

            /* replace empty string with null to allow filtering/visibility */
            var user_data = data.map(function(row){
               for (var col in row){
                  if (row[col] === ""){
                     row[col] = "null";
                  };
               }
               return row;
            });
            
            data_filter = new FilterHolder(user_data, user_config.filterables, infro_unit, d3.sum)
               .on_change(function(){
               /* if all filters selected, then switch to the connections page */
               if (data_filter.filters().length >= selects.display_units.current.length){
                  tabs.content.set(display_units+"_tab_wrapper");
               }
               cached_distributions = {};
               render_visualisation();
            });
            
            var standard_metrics = {"Total":d3.sum,
                                                   "Max":d3.max,
                                                   "Min":d3.min,
                                                   "Mean":d3.mean
                                                 }
            var extra_metrics = config.metrics;
            
            var all_metrics = d3.entries(standard_metrics).concat(d3.entries(extra_metrics))
                                          .map(function(m){return {key:m.value, value:{human:m.key}};});
            
            var fields = data_filter.metrics().map(function(key){return {key:key, value:{human:data_filter.human(key)}}});

            var unit = {key:infro_unit, value:{human: user_config.unit}};
            fields.push(unit);
            selects = {metric: new Select(fields, unit.key, "Select the metric you are interested in exploring.")
                                       .on_change(data_filter.set_metric),
                        aggreg: new Select(all_metrics, d3.sum, "Select the method of aggregating the data together.")
                                       .on_change(data_filter.set_aggregation)
                     };
                                                
            selects[display_units] = new Select(data_filter.fields().map(function(key){return {key:key, value:{human:data_filter.human(key)}}}),
                                             data_filter.filterables(),
                                             "Select the columns you wish to display on the units page.",
                                             user_config.unit+' fields')
                                                .on_change(render_visualisation);
            tabs = {content: new TabSet(
                           [
                              {key:"filterables", value:{human:"Filters", content:render_filterables}},
                              {key:display_units+"_tab_wrapper", value:{human:user_config.unit, content:render_units}}
                            ],
                            "filterables"),
                        };
                                                
            var columns = data_filter.fields();
            /* calculate the max (bounded) length of each field to use renedering the units page */
            var _data_ = data_filter.apply();
            columns.forEach(function(key){
               column_lengths[key] = d3.max([data_filter.human(key).length, 
                                        d3.min([
                                                d3.max(pull_out_field(_data_, key).map(function(value){
                                                   return String(data_filter.format(key, value)).length;
                                                   })),
                                                60])
                                       ]);
            });
            
            render_visualisation(); 
         }
      );      
   };
   
   var exposed_methods =  {
      init:init_visualisation,
      formatters:{
         data_size:datasize_formatter,
         duration:duration_formatter
      },
      scales:{
         log:d3.scale.log,
         linear:d3.scale.linear,
         time:d3.time.scale,
         pow:d3.scale.pow
      }
   };
   
   return exposed_methods;

})();
