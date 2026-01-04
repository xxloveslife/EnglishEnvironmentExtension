// DOM辅助函数
export const generateNodeId = (node: Node): string => {
  const parent = node.parentElement
  if (!parent) return 'root'
  
  const siblings = Array.from(parent.childNodes)
  const index = siblings.indexOf(node as ChildNode)
  return `${getDomPath(parent)}-text-${index}`
}

export const getDomPath = (element: Element): string => {
  if (!element || element === document.documentElement) {
    return 'html'
  }
  
  const path: string[] = []
  let current: Element | null = element
  
  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase()
    
    if (current.id) {
      selector += `#${current.id}`
    } else if (current.className) {
      const classes = current.className.split(' ').filter(c => c.trim())
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`
      }
    }
    
    // 添加兄弟节点索引
    const siblings = Array.from(current.parentElement?.children || [])
    const sameTagSiblings = siblings.filter(s => s.tagName === current?.tagName)
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.indexOf(current) + 1
      selector += `:nth-of-type(${index})`
    }
    
    path.unshift(selector)
    current = current.parentElement
  }
  
  return path.join(' > ')
}

export const findElementByPath = (path: string): Element | null => {
  try {
    return document.querySelector(path)
  } catch (error) {
    console.warn('Invalid selector path:', path, error)
    return null
  }
}

export const isElementInViewport = (element: Element): boolean => {
  if (!element) return false
  
  const rect = element.getBoundingClientRect()
  const viewportHeight = window.innerHeight
  const viewportWidth = window.innerWidth
  
  return (
    rect.top < viewportHeight &&
    rect.bottom > 0 &&
    rect.left < viewportWidth &&
    rect.right > 0
  )
}

export const getTextNodePosition = (textNode: Node): DOMRect => {
  const range = document.createRange()
  range.selectNode(textNode)
  return range.getBoundingClientRect()
}

export const isChineseText = (text: string): boolean => {
  return /[\u4e00-\u9fa5]/.test(text)
}

export const hasVisibleText = (element: Element): boolean => {
  const style = window.getComputedStyle(element)
  const el = element as HTMLElement
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0' &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  )
}




