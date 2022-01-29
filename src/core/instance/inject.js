/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

/**
 * 1. 解析inject选项,得到 key:value格式对象
 * 2. 解析好的对象丢到响应式处理
 */
export function initInjections (vm: Component) {
  // provide inject 配合的原理是, 在组件定义发现inject的时候, 去$parent链上
  // 找对应的 provide, 找到后整合成一个 {key: provide(key) } 的数据格式
  const result = resolveInject(vm.$options.inject, vm)

  // 响应式处理
  if (result) {
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

/**
 * @param {*} inject={
 *    key: {
 *      from: provideKey,
 *      default: foo
 *    }
 * }
 */
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached

    // Object.create(null)没有继承任何原型方法，也就是说它的原型链没有上一层。
    const result = Object.create(null)

    // 拿到inject配置项的key列表
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)

    // 遍历inject keys
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      if (key === '__ob__') continue
      const provideKey = inject[key].from

      // 沿着parent链寻找 inject 的key 对应的 from
      let source = vm
      while (source) {
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }

      // 没找到就设置default
      if (!source) {
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }

    // 返回的格式 { key: source._provided[provideKey] , // ...}
    return result
  }
}
