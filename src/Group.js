// @flow

import React  from 'react'

type GroupOptionsType<K, T> = {
  id: string,
  title?: ?string,
  groupingFunction : (T) => K,
  renderer? : (T) => any, // React.Node
  comparator? : (groupKey1: K, groupKey2: K) => number
};

export default class Group<K, T> {
  id: string
  title: string
  groupingFunction : (T) => K
  renderer : (T, Group<any, any>) => any = (v: any, g) => <span>{ g.title }: <b>{ v }</b></span> // eslint-disable-line
  comparator : (groupKey1: K, groupKey2: K, aggregate1: ?any, aggregate2: ?any) => number = (a: K, b: K) => a === b ? 0 : (a: any) < (b: any) ? -1 : 1

  constructor(options : GroupOptionsType<K, T>) {
    this.id = options.id
    this.groupingFunction = options.groupingFunction
    this.title = options.title != null ? options.title : options.id
    if (options.renderer != null)
      this.renderer = options.renderer
    if (options.comparator != null)
      this.comparator = options.comparator
  }
}
