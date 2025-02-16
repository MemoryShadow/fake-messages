<template>
  <div class="container">
    <Form :label-width="80" inline>
      <FormItem label="接收手机">
        <AutoComplete v-model="filters.toMobile"
                      :data="options.toMobiles"
                      @on-change="fetchToMobiles" />
      </FormItem>
      <FormItem label="标签">
        <Select v-model="filters.tags" multiple clearable style="width:200px">
          <Option v-for="tag in options.tags" :value="tag" :key="tag">{{ tag }}</Option>
        </Select>
      </FormItem>
      <FormItem label="起始时间">
        <DatePicker v-model="filters.createdAtFrom" type="datetime" placeholder="选择最小时间" style="width: 200px" />
      </FormItem>
      <FormItem label="截止时间">
        <DatePicker v-model="filters.createdAtTo" type="datetime" placeholder="选择最大时间" style="width: 200px" />
      </FormItem>
    </Form>
    <Table :row-class-name="tableRowClassName" :columns="columns" :data="messages"
           @on-row-click="readRow">
      <template slot-scope="{ row }" slot="toMobile">
        <a @click="filters.toMobile = row.toMobile">
          {{ row.toMobile }}
        </a>
      </template>
      <template slot-scope="{ row }" slot="tags">
        <Tag v-for="tag in row.tags" :key="tag" @click.native="addTagFilter(tag)">
          {{ tag }}
        </Tag>
      </template>
      <template slot-scope="{ row }" slot="createdAt">
        {{ row.createdAt | datetime }}
      </template>
    </Table>
    <br>
    <Page :total="pageInfo.total" :page-size="pageInfo.size" :current="pageInfo.number" @on-change="pageNumberChanged" />
  </div>
</template>

<script>
import axios from 'axios'
import websocket from '@/websocket'

export default {
  name: 'MessageList',
  data() { 
    return {
      columns: [
        {
          title: '接收手机',
          slot: 'toMobile'
        },
        {
          title: '标签',
          slot: 'tags'
        },
        {
          title: '内容',
          key: 'content'
        },
        {
          title: '时间',
          slot: 'createdAt'
        }
      ],
      messages: [],
      filters: {
        toMobile: '',
        tags: [],
        createdAtFrom: undefined,
        createdAtTo: undefined
      },
      pageInfo: {
        number: 1,
        size: 10,
        total: 0
      },
      options: {
        tags: [],
        toMobiles: []
      }
    }
  },
  computed: {
    pageParams () {
      return {
        from: (this.pageInfo.number - 1) * this.pageInfo.size + 1,
        size: this.pageInfo.size
      }
    }
  },
  watch: {
    filters: {
      deep: true,
      handler () {
        this.pageInfo.number = 1
        this.fetchMessages()
      }
    }
  },
  methods: {
    pageNumberChanged (newPageNumber) {
      this.pageInfo.number = newPageNumber
      this.fetchMessages()
    },
    fetchMessages () {
      axios.get('/short_messages', { params: { ...this.filters, ...this.pageParams } })
        .then(response => {
          const data = response.data
          this.messages = data.messages
          this.pageInfo.total = data.total
        })
        .catch(function () {
          console.log('error', arguments);
        })
    },
    fetchToMobiles (filter = '') {
      axios.get('/short_messages/toMobiles', { params: { filter } })
        .then(({ data: { toMobiles }}) => {
          this.options.toMobiles = toMobiles
        })
        .catch(function () {
          console.log('error', arguments);
        })
    },
    fetchTags () {
      axios.get('/short_messages/tags')
        .then(({ data: { tags }}) => {
          this.options.tags = tags
        })
        .catch(function () {
          console.log('error', arguments);
        })
    },
    tableRowClassName (row, index) {
      return row.isNew ? 'new-item' : ''
    },
    readRow (_, index) {
      this.messages[index].isNew = false
    },
    isMatchFilters (message) {
      if (this.filters.toMobile && message.toMobile !== this.filters.toMobile) {
        return false
      }
      if (this.filters.tag && message.tags.indexOf(this.filters.tag) === -1) {
        return false
      }
      if (this.filters.createdAtFrom && new Date(message.createdAt) < this.filters.createdAtFrom) {
        return false
      }
      if (this.filters.createdAtTo && new Date(message.createdAt) > this.filters.createdAtTo) {
        return false
      }
      return true
    },
    addTagFilter (tag) {
      if (this.filters.tags.indexOf(tag) === -1) {
        this.filters.tags.push(tag)
      }
    }
  },
  created () {
    this.fetchMessages()
    this.fetchToMobiles()
    this.fetchTags()

    // 因为使用了keep-alive，不需要removeEventListener之类的操作
    websocket.addEventListener('NewMessage', ({ data: message }) => {
      if (this.isMatchFilters(message)) {
        message.isNew = true
        this.messages.unshift(message)

        if (this.$global.notificating) {
          Notification.requestPermission(function(status) {
            new Notification(`手机号 ${message.toMobile} 收到一条新消息`, { body: message.content })
          })
        }
      }
    })
  }
}
</script>

<style scoped>
.container {
  min-height: 600px; /* 添加最小高度只为日期选择器能够完整地展示出来 */
}
</style>
