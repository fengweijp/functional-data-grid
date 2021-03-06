// @flow

import React from 'react'
import ReactDOM from 'react-dom'
import BaseColumn from './BaseColumn'
import ColumnGroup from './ColumnGroup'
import { List, Map, OrderedMap, KeyedSeq } from 'immutable'
import Filter from './Filter'
import Sort from './Sort'
import Header from './Header'
import Row from './Row'
import { ScrollSync, AutoSizer, List as ReactVirtualizedList } from 'react-virtualized'
import Group from "./Group"
import DataGroup from "./DataGroup"
import DataRow from './DataRow'
import Aggregate from './Aggregate'
import debounce from 'debounce'
import Footer from './Footer'
import HorizontalScrollbar from './HorizontalScrollbar'

const debounceTimeout = 250
const defaultInitialColumnWidth = 100
const defaultRowHeight = 26

type FunctionalDataGridStyle = {
  grid?: Object,
  header?: Object,
  footer?: Object,
  group?: Object,
  aggregate?: Object,
  row?: Object,
  cell?: Object,
}

type FunctionalDataGridProps<T, A> = {
  columns: List<BaseColumn | ColumnGroup>,
  initialFilter : List<Filter>,
  initialSort : List<Sort>,
  groups : List<Group<any, T>>,
  data : List<T>,
  style : FunctionalDataGridStyle,
  aggregatesCalculator: ?((List<T>, any) => A),
  showGroupHeaders: boolean,
  rowHeight: number | ((T) => number),
  includeFilteredElementsInAggregates: boolean,
  onColumnResize: (Object) => void,
  onColumnsOrderChange: (Object) => void,
  onColumnVisibilityChange: (Object) => void,
  showFooter: boolean,
  className: 'string',
  overscanRowCount: number,
  sortableColumns: boolean,
  enableColumnsSorting: boolean,
  enableColumnsShowAndHide: boolean
}
type FunctionalDataGridState<T> = {
  cachedElements : List<DataRow<T>>,
  sort : List<Sort>,
  filter : List<Filter>,
  columnsWidth : Map<string, number>,
  columnsVisibility: Map<string, boolean>,
  columnsOrder: List<string>,
  ref: ?HTMLElement
}

export default class FunctionalDataGrid<T, A: void> extends React.PureComponent<FunctionalDataGridProps<T, A>, FunctionalDataGridState<T>> {

  props: FunctionalDataGridProps<T, A>
  state : FunctionalDataGridState<T>
  list : ReactVirtualizedList
  debouncedUpdateElements = debounce((data : List<T>, groups : List<Group<any, T>>, sort : List<Sort>, filter : List<Filter>) => this.updateElements(data, groups, sort, filter), debounceTimeout);

  static defaultProps = {
    initialFilter : List(),
    initialSort : List(),
    groups : List(),
    style : {},
    aggregatesCalculator: null,
    showGroupHeaders: true,
    rowHeight: defaultRowHeight,
    includeFilteredElementsInAggregates: false,
    onColumnResize: (e: Object) => {},
    onColumnsOrderChange: (e: Object) => {},
    onColumnVisibilityChange: (e: Object) => {},
    showFooter: true,
    className: '',
    overscanRowCount: 10,
    enableColumnsSorting: false,
    enableColumnsShowAndHide: false
  }

  constructor(props : FunctionalDataGridProps<T, A>) {
    super(props)
    this.state = {
      cachedElements : List(),
      sort : this.props.initialSort,
      filter : this.props.initialFilter,
      columnsWidth : this.getInitialColumnsWidth(props.columns),
      columnsVisibility: this.getInitialColumnsVisibility(props.columns),
      columnsOrder: props.columns.map(c => c.id),
      ref: null
    }
  }

  getInitialColumnsWidth = (columns : List<BaseColumn | ColumnGroup>) => columns.groupBy(c => c.id).map(v => v.get(0).width != null ? v.get(0).width : defaultInitialColumnWidth)

  getInitialColumnsVisibility = (columns : List<BaseColumn | ColumnGroup>) => columns.groupBy(c => c.id).map(v => v.get(0).hidden != null ? ! v.get(0).hidden : true)

  updateColumnVisibility = (columnId: string, columnVisibility: boolean) => {
    this.setState({
      columnsVisibility: this.state.columnsVisibility.set(columnId, columnVisibility)
    })
    this.props.onColumnVisibilityChange({id: columnId, visible: columnVisibility})
  }

  componentWillMount = () => {
    this.updateElements(this.props.data, this.props.groups, this.state.sort, this.state.filter)
  }

  componentWillUpdate = (newProps: any) => {
    if (newProps.data !== this.props.data)
      this.debouncedUpdateElements(newProps.data, newProps.groups, this.state.sort, this.state.filter)
  }

  getRowHeight = () => {
    let rowHeight = this.props.rowHeight
    return rowHeight instanceof Function
    ? (args: Object) => {
      let element = this.getElement(args.index)
      return rowHeight(element.content, element.originalIndex, element.type)
    }
    : rowHeight
  }

  render = () => {
    let style = {display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', border: 'solid 1px #ccc'}
    return <div ref={ref => this.setState({ ref: ref })} className={`functional-data-grid ${this.props.className}`} style={{...style, ...(this.props.style.grid != null ? this.props.style.grid : {})}}>
      <ScrollSync>
        {({clientHeight, clientWidth, onScroll, scrollHeight, scrollLeft, scrollTop, scrollWidth}) => (
          <div style={{display: 'flex', flexDirection: 'column', height: '100%'}}>
            <Header columns={this.getOrderedColumns()} columnsVisibility={this.state.columnsVisibility} columnsWidth={this.state.columnsWidth} scrollLeft={scrollLeft} onScroll={onScroll} style={this.props.style.header != null ? this.props.style.header : {}} sort={this.props.initialSort} onUpdateSort={this.updateSortState} onUpdateFilter={this.updateFilterState} onColumnResize={this.resizeColumn} enableColumnsShowAndHide={this.props.enableColumnsShowAndHide} enableColumnsSorting={this.props.enableColumnsSorting} onColumnVisibilityChange={this.updateColumnVisibility} onColumnsOrderChange={this.onColumnsOrderChange} columnsOrder={this.state.columnsOrder} popperContainer={this.state.ref} />
            <div style={{flexGrow: 1}}>
              <AutoSizer>
                {({height, width}) => (
                    <ReactVirtualizedList
                      rowCount={this.getTotalCount()}
                      height={height}
                      width={width}
                      rowHeight={this.getRowHeight()}
                      rowRenderer={this.rowRenderer(scrollLeft, onScroll)}
                      ref={(list) => { this.list = list }}
                      style={{backgroundColor: '#fff', outline: 'none'}}
                      overscanRowCount={this.props.overscanRowCount} >
                    </ReactVirtualizedList>
                )}
              </AutoSizer>
            </div>
            <HorizontalScrollbar enableColumnsMenu={this.props.enableColumnsShowAndHide || this.props.enableColumnsSorting} columnsVisibility={this.state.columnsVisibility} columns={this.getOrderedColumns()} columnsWidth={this.state.columnsWidth} scrollLeft={scrollLeft} onScroll={onScroll} />
            { this.props.showFooter && <Footer style={this.props.style.footer != null ? this.props.style.footer : {}} totalElements={this.getElements().filter(r => r.type === 'element').size} /> }
          </div>
        )}
      </ScrollSync>
    </div>
  }

  getOrderedColumns = () => this.state.columnsOrder.map(columnId => this.props.columns.find(c => c.id === columnId))

  rowRenderer = (scrollLeft : number, onScroll : Function) => (param: { key: number, index: number, style: Object }) => {
    let element = this.getElement(param.index)
    let rowStyle = this.props.style.row != null ? this.props.style.row : {}
    let computedStyle = {...param.style, ...rowStyle}
    return <Row key={param.index} style={computedStyle} cellStyle={this.props.style.cell != null ? this.props.style.cell : {}} aggregateStyle={this.props.style.aggregate != null ? this.props.style.aggregate : {}} groupStyle={this.props.style.group != null ? this.props.style.group : {}} groups={this.props.groups} columns={FunctionalDataGrid.flatColumns(this.getOrderedColumns())} columnsWidth={this.state.columnsWidth} columnsVisibility={this.state.columnsVisibility} element={element} onScroll={onScroll} scrollLeft={scrollLeft} rowIndex={param.index} enableColumnsMenu={this.props.enableColumnsShowAndHide || this.props.enableColumnsSorting} />
  }

  updateElements = (data : List<T>, groups : List<Group<any, T>>, sort : List<Sort>, filter : List<Filter>) => {
    this.setState({ cachedElements: this.computeElements(data, groups, sort, filter) }, () => { this.recomputeRowHeights() })
  }

  recomputeRowHeights = () => {
    if (this.list != null)
      this.list.recomputeRowHeights()
  }

  computeElements = (data : List<T>, groups : List<Group<any, T>>, sort : List<Sort>, filter : List<Filter>) : List<DataRow<any>> =>
    this.filterGroups(
      this.groupData(
        FunctionalDataGrid.sortData(
          this.filterData(
            FunctionalDataGrid.enrichData(data),
            filter,
            groups
          ),
          sort,
          this.props.columns
        ),
        groups
      ),
      filter,
      groups
    ).flatMap(this.flatGroups)

  flatGroups = (e: List<DataRow<T> | DataGroup<any, any, A>>) => e instanceof DataGroup
          ? e.flatten(this.props.showGroupHeaders)
          : List([e])

  static sortData = (data : List<DataRow<T>>, sort : List<Sort>, columns: List<ColumnGroup | BaseColumn>): List<DataRow<T>> => sort
    .reverse()
    .reduce((data: List<DataRow<T>>, s: Sort) =>
      FunctionalDataGrid.applySort(data, s, columns), data)

  static applySort = (data : List<DataRow<T>>, sort : Sort, columns: List<ColumnGroup | BaseColumn>): List<DataRow<T>> => {
    let column = FunctionalDataGrid.getColumnById(FunctionalDataGrid.flatColumns(columns), sort.columnId)
    return data.sortBy((e: DataRow<T>) => column.valueGetter(e.content), (a, b) => (sort.direction === 'asc' ? 1 : -1) * column.comparator(a, b))
  }

  getColumnById = (columnId : string) => FunctionalDataGrid.getColumnById(FunctionalDataGrid.flatColumns(this.props.columns), columnId)

  static getColumnById = (columns: List<BaseColumn>, columnId: string) => {
    let column = columns.find(c => c.id === columnId)
    if (column == null)
      throw new Error('Invalid column id')
    return column
  }

  static enrichData = (data : List<T>) : List<DataRow<T>> => data.map((e, index) => new DataRow(e, 'element', index))

  getElement = (index : number) => this.getElements().get(index)

  getElements = () => this.state.cachedElements

  groupData = <K,> (data : List<DataRow<T>>, groups : List<Group<any, T>>, currentSubGroup: List<[string, any]> = List()): (List<DataRow<T> | DataGroup<any, any, A>>) => groups.isEmpty()
    ? data
    : this.groupDataByGroup(data, groups.first(), currentSubGroup)
          .map((e : DataGroup<K, T, A>) => new DataGroup(e.key, this.groupData(e.data, groups.shift(), currentSubGroup.push([groups.first().id, ((e.key): any)[groups.first().id]])), e.aggregate))

  groupDataByGroup = <K,> (data : (List<DataRow<T>>), group : Group<K, T>, subGroup: List<[string, any]>) : List<DataGroup<K, DataRow<T>, A>> =>
    data.groupBy((e: DataRow<T>) => group.groupingFunction(e.content))
        .map((g: List<T>, key: K) => this.createDataGroup(g, group.id, key, subGroup.push([group.id, key])))
        .toList()
        .sort((dg1, dg2) => group.comparator(dg1.key, dg2.key, dg1.aggregate, dg2.aggregate))

  createDataGroup = <K,> (data: List<T>, groupId: string, key : K, subGroup: List<[string, any]>): DataGroup<any, T, Aggregate<any>> => this.props.aggregatesCalculator != null
    ? new DataGroup(this.getGroupKey(subGroup), data, this.createAggregate(this.getGroupKey(subGroup), data.map(e => e.content)))
    : new DataGroup(this.getGroupKey(subGroup), data)

  createAggregate = <K,> (groupKey: any, data: List<T>) : Aggregate<A> => {
    if (this.props.aggregatesCalculator == null)
      throw new Error('Aggregates calculator not specified.')
    return new Aggregate(groupKey, this.props.aggregatesCalculator(data, groupKey))
  }

  getGroupKey = (subGroup: List<[string, any]>) => {
    let groupKey: Object = {}
    subGroup.forEach((g: [string, any]) => groupKey[g[0]] = g[1])
    return groupKey
  }

  filterElementsBeforeGrouping = () => this.props.groups.isEmpty() || ! this.props.includeFilteredElementsInAggregates

  filterData = (data : List<DataRow<T>>, filters : List<Filter>, groups: List<Group<>>) => this.filterElementsBeforeGrouping() ? data.filter(e => this.applyFiltersToElement(e, filters)) : data

  filterGroups = (data : List<DataRow<T> | DataGroup<DataRow<T>>>, filters : List<Filter>, groups: List<Group<>>) => this.filterElementsBeforeGrouping() ? data : data
    .map(e => e instanceof DataGroup ? this.filterDataGroup(e, filters) : e)          // filter data group
    .filter(e => !(e instanceof DataGroup) || e.data.size > 0)                        // remove empty data groups

  filterDataGroup = <K, G> (dataGroup : DataGroup<K, G, A>, filters : List<Filter>) : DataGroup<K, T, A> =>
    new DataGroup(
      dataGroup.key,
      dataGroup.data.filter(e => e instanceof DataGroup || this.applyFiltersToElement(e, filters))
               .map(e => e instanceof DataGroup ? this.filterDataGroup(e, filters) : e)
               .filter(e => !(e instanceof DataGroup) || e.data.size > 0),
      dataGroup.aggregate
    )

  applyFiltersToElement = <T,> (e: DataRow<T>, filters : List<Filter>): boolean => filters.reduce((a: boolean, f: Filter) => a && this.applyFilterToElement(e, f), true)

  applyFilterToElement = <T,> (e : DataRow<T>, filter : Filter) : boolean => filter.matcher(this.getColumnById(filter.columnId).valueGetter(e.content))

  static flatColumns = (columns : List<BaseColumn | ColumnGroup>) => columns.flatMap(c => c instanceof ColumnGroup ? c.columns : [c])

  getTotalCount = () => this.getElements().size

  updateSortState = (columnId : string, direction : 'asc' | 'desc' | 'none') => {

    this.setState({
      'sort' : this.updateSort(this.state.sort, columnId, direction)
    }, () => {
      this.debouncedUpdateElements(this.props.data, this.props.groups, this.state.sort, this.state.filter)
    })
  }

  updateFilterState = (columnId : string, matcher : Function) => {

    this.setState({
      'filter' : this.updateFilter(this.state.filter, columnId, matcher)
    }, () => {
      this.debouncedUpdateElements(this.props.data, this.props.groups, this.state.sort, this.state.filter)
    })
  }

  updateFilter = (filter : List<Filter>, columnId : string, matcher : Function) => {
    let index = filter.findIndex(c => c.columnId === columnId)

    return index === -1
      ? filter.push(new Filter(columnId, matcher))
      : filter.set(index, new Filter(columnId, matcher))
  }

  updateSort = (sort : List<Sort>, columnId : string, direction : 'asc' | 'desc' | 'none') => {

    let index = sort.findIndex(c => c.columnId === columnId)

    if (index === -1) {
      if (direction === 'none')
        return sort
      else
        return sort.push(new Sort(columnId, direction))
    }
    else {
      if (direction === 'none')
        return sort.delete(index)
      else
        return sort.set(index, new Sort(columnId, direction))
    }
  }

  resizeColumn = (columnId : string, width : number) => {
    this.setState({
      columnsWidth: this.state.columnsWidth.set(columnId, width)
    })
    this.props.onColumnResize({id: columnId, width: width})
  }

  onColumnsOrderChange = (columnsOrder: List<string>) => {
    this.setState({
      columnsOrder
    })
    this.props.onColumnsOrderChange({columnsOrder})
  }
}
