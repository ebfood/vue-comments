/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0
/**
 * 处理组件配置项
    初始化根组件时进行了选项合并操作，将全局配置合并到根组件的局部配置上
    初始化每个子组件时做了一些性能优化，将组件配置对象上的一些深层次属性放到 vm.$options 选项中，以提高代码的执行效率
 * 初始化组件实例的关系属性，比如 $parent、$children、$root、$refs 等
 * 处理自定义事件
 * 调用 beforeCreate 钩子函数
 * 初始化组件的 inject 配置项，得到 ret[key] = val 形式的配置对象，然后对该配置对象进行浅层的响应式处理（只处理了对象第一层数据），并代理每个 key 到 vm 实例上
 * 数据响应式，处理 props、methods、data、computed、watch 等选项
 * 解析组件配置项上的 provide 对象，将其挂载到 vm._provided 属性上
 * 调用 created 钩子函数
 * 如果发现配置项上有 el 选项，则自动调用 $mount 方法，也就是说有了 el 选项，就不需要再手动调用 $mount 方法，反之，没提供 el 选项则必须调用 $mount
 * 接下来则进入挂载阶段
   作者：李永宁
   链接：https://juejin.cn/post/6950084496515399717
   来源：稀土掘金
 */
export function initMixin (Vue: Class<Component>) {
  Vue.prototype._init = function (options?: Object) {
    const vm: Component = this
    vm._uid = uid++
    vm._isVue = true

    if (options && options._isComponent) {
      // 子组件性能优化：展开options，避免原型链动态查找
      initInternalComponent(vm, options)
    } else {
      // 根组件走到这里，进行选项合并, 将全局配置合并到根组件的局部配置上
      // 组件选项合并发生在三个地方：
      // 1. Vue.component 注册全局组件
      // 2. components: { A, B} 局部注册组件时合并
      // 3. 这里的根组件选项合并
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor), // 处理构造函数options，合并基类选项
        options || {}, // 参数
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    
    // 组件关系属性的初始化 $parent $root $children
    initLifecycle(vm)
    // 初始化自定义事件 <comp @click="foo" /> => this.$emit('click) this.$on('click', function foo)
    initEvents(vm)
    // 初始化插槽, 定义this._c 定义 createElement方法, 平时使用的h函数
    initRender(vm)
    // beforeCreate 执行
    callHook(vm, 'beforeCreate')
    // inject 初始化, 响应式处理
    initInjections(vm) // resolve injections before data/props
    // props methods computed data watch 响应式
    initState(vm)
    // 处理provide 生成 ._provide 
    initProvide(vm) // resolve provide after data/props
    // created 钩子
    callHook(vm, 'created')

    // options中存在el的时候自动执行$mount, 交给$mount吧
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

export function initInternalComponent (
  vm: Component,
  options: InternalComponentOptions
) {
  const opts = (vm.$options = Object.create(vm.constructor.options))
  // doing this because it's faster than dynamic enumeration.
  const parentVnode = options._parentVnode
  opts.parent = options.parent
  opts._parentVnode = parentVnode

  const vnodeComponentOptions = parentVnode.componentOptions
  opts.propsData = vnodeComponentOptions.propsData
  opts._parentListeners = vnodeComponentOptions.listeners
  opts._renderChildren = vnodeComponentOptions.children
  opts._componentTag = vnodeComponentOptions.tag

  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

/**
 * 解析构造函数optionsoptions，合并基类options
 * @param {*} Ctor
 * @returns
 */
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    // 递归获取基类最新options
    const superOptions = resolveConstructorOptions(Ctor.super)

    // 取出之前保存的options
    const cachedSuperOptions = Ctor.superOptions

    // 对比刚刚拿到的和缓存的基类options
    if (superOptions !== cachedSuperOptions) {
      // 先缓存一波, 以供下次检查
      Ctor.superOptions = superOptions
      //  检查 Ctor.options 上是否有任何后期修改/附加的选项（＃4976）
      const modifiedOptions = resolveModifiedOptions(Ctor)
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      // 合并选项，把合并基类options后的options赋值回去
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  // 构造函数选项
  const latest = Ctor.options
  // 密封的构造函数选项，备份
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
