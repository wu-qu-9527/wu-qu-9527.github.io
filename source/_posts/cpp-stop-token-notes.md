---
title: C++20 std::stop_token：线程的协作式取消
slug: cpp-stop-token
date: 2026-10-07
tags:
  - 语法糖
description: 了解 std::stop_source、std::stop_token、std::stop_callback、std::jthread 与 condition_variable_any，写出可以及时响应取消请求的任务。
topics:
  - slug: cpp-concurrency
    title: C++ 并发与协作式取消
    description: 从线程生命周期、取消请求到可中断等待，整理现代 C++ 并发编程实践。
---

`std::stop_token` 是 C++20 提供的取消通知机制。它让一个线程发出“请停止”的请求，另一个线程定期检查并自行收尾。它不会强行中断或杀死线程，因此也常称为**协作式取消**。

## 三个核心类型

`<stop_token>` 中最常用的三个类型各司其职：

| 类型 | 用途 |
| --- | --- |
| `std::stop_source` | 发出取消请求，并创建关联的 token。 |
| `std::stop_token` | 传给任务，让任务查询是否收到取消请求。 |
| `std::stop_callback` | 在关联状态首次收到取消请求时执行回调。 |

它们共享同一个 stop state。调用 `request_stop()` 会设置这个状态；所有关联 token 随后都能通过 `stop_requested()` 观察到请求。

## `std::condition_variable_any`：等待条件，也响应取消

条件变量让线程在某个共享条件尚未满足时休眠，等其他线程修改状态并发出通知后再检查。条件本身通常是共享数据上的谓词；**通知不是事件队列**，真正的状态要保存在受互斥锁保护的数据里。

`std::condition_variable` 只配合 `std::unique_lock<std::mutex>` 使用。`std::condition_variable_any` 接受更一般的锁类型，并在 C++20 增加了带 `std::stop_token` 的等待重载。因此它可以同时等待“队列有任务”或“收到取消请求”。

```cpp
#include <condition_variable>
#include <deque>
#include <iostream>
#include <mutex>
#include <stop_token>
#include <thread>

std::mutex mutex;
std::condition_variable_any changed;
std::deque<int> jobs;

void enqueue(int job)
{
    {
        std::lock_guard lock(mutex);
        jobs.push_back(job);
    }
    changed.notify_one();
}

int main()
{
    std::jthread worker([](std::stop_token stop) {
        while (true) {
            std::unique_lock lock(mutex);
            const bool has_job = changed.wait(lock, stop, [] {
                return !jobs.empty();
            });

            if (!has_job) {
                // stop 已请求，且队列仍为空。
                return;
            }

            const int job = jobs.front();
            jobs.pop_front();
            lock.unlock();

            std::cout << "处理任务：" << job << '\n';
        }
    });

    enqueue(42);
    worker.request_stop();
}
```

带 token 的 `wait` 返回 `true` 表示谓词成立，返回 `false` 表示等待因停止请求结束且谓词仍不成立。上例会先处理已经排入队列的任务；队列清空后，停止请求会唤醒等待并让线程退出。若想在取消时丢弃队列里的待处理任务，可以在取出任务前额外检查 `stop.stop_requested()`，并明确处理剩余队列。

条件变量等待可能发生虚假唤醒，所以要用谓词重载，或在循环里重新检查条件。生产者应先在锁内更新共享状态，再释放锁并调用 `notify_one()`；多个消费者都需要重新检查状态时，可用 `notify_all()`。没有谓词的裸 `wait()` 不能保证“被唤醒就代表条件成立”。

## 使用 `std::jthread` 请求停止

`std::jthread` 会在调用无参 stop-token 参数的可调用对象时，自动把自己的 token 作为第一个参数传入。析构时它会先请求停止，再等待线程结束；任务仍需主动响应请求。

```cpp
#include <chrono>
#include <condition_variable>
#include <iostream>
#include <mutex>
#include <stop_token>
#include <thread>

using namespace std::chrono_literals;

void worker(std::stop_token stop)
{
    std::mutex mutex;
    std::condition_variable_any wakeup;
    std::unique_lock lock(mutex);

    while (!stop.stop_requested()) {
        // C++20 的 stop-token 重载会在收到停止请求时唤醒等待。
        // 谓词为 false，因此超时后也会返回，任务可以定期检查状态。
        wakeup.wait_for(lock, stop, 200ms, [] { return false; });

        if (stop.stop_requested()) {
            break;
        }

        lock.unlock();
        std::cout << "执行一个工作步骤\n";
        lock.lock();
    }

    std::cout << "收到停止请求，开始清理\n";
}

int main()
{
    std::jthread task(worker);

    std::this_thread::sleep_for(1s);
    task.request_stop();
    // task 离开作用域时会 join；worker 响应请求后可以正常返回。
}
```

这里再次使用 `std::condition_variable_any` 的 stop-token 定时等待重载。普通 `std::condition_variable` 没有这个 C++20 重载。若直接使用 `sleep_for()` 或不可取消的阻塞调用，停止请求只能等它们返回后才会被处理。

## 显式使用 `std::stop_source`

当请求方和任务并不通过 `std::jthread` 持有彼此时，可以自己创建 source，再把 token 传给任务：

```cpp
std::stop_source source;
std::stop_token token = source.get_token();

std::thread task([token] {
    while (!token.stop_requested()) {
        do_one_step();
    }
    cleanup();
});

source.request_stop();
task.join();
```

真实项目里要注意线程安全地管理共享数据；上例只展示取消信号的传递方式。若任务涉及可能长期阻塞的等待，应让等待本身能响应取消，或者使用有界等待并定期检查 token。

## 取消回调

`std::stop_callback` 监听 token 关联的停止请求，并执行一次回调：

```cpp
std::stop_callback on_stop(stop, [&]() noexcept {
    cancelled.store(true, std::memory_order_relaxed);
});
```

这里的 `stop` 是 `std::stop_token`，`cancelled` 是 `std::atomic<bool>`，回调可用于设置取消标记或通知等待方。

- token 没有关联 stop state 时，回调不会执行。
- 已经请求停止时，回调在注册线程中立即执行，否则在首次成功调用 `request_stop()` 的线程中执行。
- 回调同步执行，应保持简短、不抛异常，并避免阻塞或死锁。
- 回调对象析构时会注销回调，必要时等待其他线程中的回调完成，因此捕获对象必须保持有效。

使用 `std::condition_variable_any` 的 stop-token 等待重载时，通常无需手动注册回调。

## 常见误区

- **它不会强制杀线程。** 任务必须检查 `stop_requested()`，并从可取消等待中返回。
- **请求不可撤销。** 同一 stop state 的停止状态是一种单向通知，不能“恢复运行”。
- **`jthread` 析构仍可能等待。** 如果工作函数忽略停止请求或卡在不可取消的阻塞调用里，自动 `join()` 仍然会等它。
- **token 是观察者。** 持有 `stop_token` 的代码可以检查状态，但需要 `stop_source` 或关联 `jthread` 才能发出请求。
- **回调可能同步执行。** 把回调当作 `request_stop()` 调用路径的一部分，避免在其中做长时间工作或产生锁顺序问题。

## 记忆方式

```text
stop_source 发出请求
        ↓ 共享 stop state
stop_token 观察状态 ──→ 任务检查并自行结束
        ↓
stop_callback 执行取消通知
```

参考：C++ 工作草案 [`<stop_token>`](https://eel.is/c++draft/thread.stoptoken)、[`std::condition_variable_any`](https://eel.is/c++draft/thread.condition.condvarany) 与 [`std::jthread`](https://eel.is/c++draft/thread.jthread.class)。
